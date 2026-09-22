export const JEV_TIMEOUT_RETRY = Object.freeze({ attempts: 3, backoffMs: 500 });
/** Wall-clock quotas survive round changes; retry streak and sim pacing do not. */
export class JevRequestPolicy {
  constructor({ clock = Date.now, publicRelay = false } = {}) {
    this.clock = clock;
    this.intervalMs = publicRelay ? 1200 : 650;
    this.nextRequestMs = 0;
    this.retryUntilMs = 0;
    this.resetRound();
  }
  resetRound() {
    this.timeoutFailures = 0;
    this.next = 0;
  }
  get coolingDown() {
    return this.clock() < this.retryUntilMs;
  }
  ready(simTime) {
    return simTime >= this.next && this.clock() >= this.nextRequestMs && !this.coolingDown;
  }
  sent(simTime, interval) {
    this.next = simTime + interval;
    this.nextRequestMs = this.clock() + this.intervalMs;
  }
  succeeded() {
    this.timeoutFailures = 0;
  }
  retryTimeout(simTime) {
    if (++this.timeoutFailures >= JEV_TIMEOUT_RETRY.attempts) return false;
    this.next = simTime;
    this.nextRequestMs = Math.max(
      this.nextRequestMs,
      this.clock() + JEV_TIMEOUT_RETRY.backoffMs * 2 ** (this.timeoutFailures - 1),
    );
    return true;
  }
  failed(simTime, retryAfter = 0) {
    this.next = simTime + 10;
    this.retryUntilMs = Math.max(
      this.retryUntilMs,
      this.clock() + Math.min(86400, Math.max(0, retryAfter)) * 1000,
    );
  }
}
