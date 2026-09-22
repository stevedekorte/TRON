import { JevStats } from './jev-stats.js';
import { JevTransport } from './jev-transport.js';
import { JevRequestPolicy, JEV_TIMEOUT_RETRY } from './jev-request-policy.js';
import { selectParticipant } from './jev-participants.js';
import { configFor } from '../game/config.js';
import { TACTICAL } from '../game/tactical.js';
export { JEV_TIMEOUT_RETRY } from './jev-request-policy.js';

/** Coordinates round-scoped participants; transport and pacing have separate owners. */
export class JevClient {
  constructor(
    fetchImpl = fetch,
    apiBase = import.meta.env?.VITE_JEV_API_BASE || '',
    {
      clock = Date.now,
      elapsed = () => performance.now(),
      setTimer = (fn, ms) => setTimeout(fn, ms),
      clearTimer = (id) => clearTimeout(id),
    } = {},
  ) {
    this.clock = clock;
    this.elapsed = elapsed;
    this.transport = new JevTransport({ fetchImpl, apiBase, setTimer, clearTimer });
    this.policy = new JevRequestPolicy({ clock, publicRelay: !!apiBase });
    this.stats = new JevStats(clock);
    this.statsRun = null;
    this.epoch = 0;
    this.round = 0;
    this.warning = null;
    this.status = 'Off';
    this.history = [];
  }
  cancelPending() {
    this.epoch++;
    this.pending?.abort();
    this.pending = null;
  }
  resetScheduling() {
    this.cancelPending();
    this.policy.resetRound();
    this.run = null;
    this.history = [];
    this.status = 'Off';
  }
  beginRound(run) {
    this.resetScheduling();
    this.run = run;
    if (this.statsRun !== run) {
      this.statsRun = run;
      this.stats = new JevStats(this.clock);
      this.round++;
    }
  }
  disengageAutoplay(autoplay, run) {
    if (!autoplay?.enabled) return;
    autoplay.setEnabled(false);
    run.cruiseThrottle = false;
    if (this.warning && !this.warning.detail.includes('Autoplay disengaged'))
      this.warning = {
        ...this.warning,
        detail: this.warning.detail + ' Autoplay disengaged; press U to retry.',
      };
  }
  update(run, playing, autoplay = null) {
    const config = configFor(run);
    if (this.disposed) return;
    if (this.run !== run) this.beginRound(run);
    if ((config.aiMode !== 'jev' && !autoplay?.enabled) || !playing || run.crushed) {
      if (this.pending) this.cancelPending();
      this.status =
        config.aiMode === 'local' ? 'Local planner' : config.aiMode === 'jev' ? 'Paused' : 'Off';
      return;
    }
    if (this.policy.coolingDown) {
      this.disengageAutoplay(autoplay, run);
      this.status = 'Local fallback: public AI cooldown';
      return;
    }
    if (this.pending || !this.policy.ready(run.time)) return;
    const participant = selectParticipant(run, autoplay, this.lastOwner);
    if (!participant) {
      this.status = 'Local tactics (no nearby eligible contact)';
      return;
    }
    const t = participant.plan,
      snapshot = structuredClone(t.snapshot);
    const ticket = {
      sessionId: this.round,
      epoch: this.epoch,
      unitId: participant.id,
      revision: t.revision,
      teleportRevision: participant.teleportRevision,
      observedAt: run.time,
    };
    this.lastOwner = participant.owner;
    t.requested = ticket.revision;
    this.policy.sent(run.time, TACTICAL.requestInterval);
    this.status = 'Waiting for Jev';
    const controller = new AbortController();
    this.pending = controller;
    const sentAt = this.elapsed(),
      stats = this.stats,
      requestStats = stats.sent(snapshot);
    const current = () =>
      ticket.epoch === this.epoch && ticket.sessionId === this.round && this.run === run;
    this.transport
      .request(snapshot, controller.signal)
      .then((answer) => {
        stats.settle(requestStats, answer.usage); // A late response still belongs to its original billing round.
        if (!current() || !participant.current()) return;
        this.policy.succeeded();
        this.warning = null;
        const accepted = participant.apply(answer, ticket.revision, ticket.observedAt);
        this.status = accepted ? 'Jev active' : 'Local fallback (stale or uncertain answer)';
        this.history.push({
          unit: ticket.unitId,
          time: ticket.observedAt,
          latencyMs: Math.round(this.elapsed() - sentAt),
          accepted,
          request: snapshot,
          response: answer,
        });
        this.history = this.history.slice(-12);
      })
      .catch((error) => {
        if (!current() || error.code === 'cancelled') return;
        const timedOut = error.code === 'timeout',
          reason = timedOut ? 'Request timed out' : error.message;
        if (timedOut && this.policy.retryTimeout(run.time)) {
          this.warning = {
            level: 'warning',
            label: 'JEV RETRY',
            detail: `Request timed out. Retrying (${this.policy.timeoutFailures}/${JEV_TIMEOUT_RETRY.attempts - 1}); autoplay continues locally.`,
          };
          this.status = 'Retrying Jev after timeout';
          if (t.requested === ticket.revision) t.requested = null;
          return;
        }
        this.warning = {
          level: 'warning',
          label: error.code === 'limited' ? 'JEV LIMIT' : 'JEV UNAVAILABLE',
          detail: reason + '. Local AI remains active.',
        };
        this.disengageAutoplay(autoplay, run);
        this.status = 'Local fallback: ' + reason;
        this.policy.failed(run.time, error.retryAfter);
      })
      .finally(() => {
        if (this.pending === controller) this.pending = null;
      });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.resetScheduling();
  }
}
