import { avoidDebris } from './debris-avoidance.js';
import { AutoplayMission } from './autoplay-mission.js';
import { RouteFollower } from './route-follower.js';
import { visibleAutoplayEnemies, autoplayThreats } from './autoplay-perception.js';
import { AUTOPLAY } from '../game/autoplay.js';
import { angleDelta, clamp } from '../game/config.js';
import { cannonTarget } from './run.js';
export { AUTOPLAY } from '../game/autoplay.js';
export { visibleAutoplayEnemies, autoplayThreats } from './autoplay-perception.js';

export class Autoplay {
  constructor() {
    this.enabled = false;
    this.manualFire = false;
    this.mission = new AutoplayMission();
    this.follower = new RouteFollower();
    this.reset();
  }
  reset() {
    this.revision = (this.revision || 0) + 1;
    this.tactical = null;
    this.teleportRevision = null;
    this.mission.reset();
    this.follower.reset();
  }
  setEnabled(value, {manualFire = false} = {}) {
    this.enabled = value;
    this.manualFire = value && manualFire;
    this.reset();
  }
  plan(run) {
    this.tactical = this.mission.plan(run, this.tactical?.plan, ++this.revision);
    this.tactical.snapshot = structuredClone(this.tactical.snapshot);
    this.follower.accept(this.tactical.plan, this.revision, run);
    Object.defineProperty(this.tactical, 'index', {
      enumerable: true,
      get: () => this.follower.index,
    });
  }
  request(run) {
    const t = this.tactical;
    return this.enabled &&
      t &&
      t.requested !== t.revision &&
      run.time - t.started < AUTOPLAY.maxReplyAgeSeconds
      ? t
      : null;
  }
  apply(answer, revision, at, run) {
    const t = this.tactical;
    if (
      !this.enabled ||
      run.crushed ||
      !t ||
      t.revision !== revision ||
      t.teleportRevision !== run.teleportRevision ||
      run.time - at > AUTOPLAY.maxReplyAgeSeconds ||
      !Number.isFinite(answer.confidence) ||
      answer.confidence < AUTOPLAY.confidence
    )
      return false;
    const option = t.options.find((o) => o.id === answer.id);
    if (!option || (option.kind === 'evade-and-engage' && !autoplayThreats(run).length))
      return false;
    this.follower.accept(option, revision, run);
    t.plan = option;
    t.source = 'jev';
    return true;
  }
  input(run) {
    if (!this.enabled || run.crushed) return {};
    if (this.teleportRevision !== run.teleportRevision) {
      this.tactical = null;
      this.teleportRevision = run.teleportRevision;
      this.mission.visited = [];
      this.mission.invalidateRoute();
      this.follower.reset();
    }
    const threats = autoplayThreats(run);
    const threatChanged =
      this.tactical &&
      Boolean(this.tactical.snapshot.threatIds?.length) !== Boolean(threats.length);
    if (threatChanged) this.mission.invalidateRoute();
    if (
      !this.tactical ||
      threatChanged ||
      run.time >= this.tactical.nextPlan ||
      (this.mission.objectiveId !== null &&
        !run.dataBeams.some((b) => b.id === this.mission.objectiveId && b.collectedAt === null))
    )
      this.plan(run);
    if (this.follower.needsContinuation(run, this.tactical.started)) this.plan(run);
    const motion = this.follower.update(run),
      plan = this.tactical.plan;
    const target = visibleAutoplayEnemies(run).find((e) => e.id === plan.targetId);
    const lookHeading = target
      ? -Math.atan2(target.x - run.x, target.s - run.s)
      : motion.distance > 2
        ? motion.heading
        : run.yaw;
    const aim = angleDelta(run.yaw + run.turretYaw, lookHeading);
    const fire = !this.manualFire && !!target && cannonTarget(run).id === target.id && run.cooldown <= 0;
    const safety = avoidDebris(run, motion.command);
    this.debrisAvoidance = safety.active;
    return {
      ...safety.command,
      turret: -clamp(aim * AUTOPLAY.aimGain, -1, 1),
      fire,
      firePressed: fire,
    };
  }
  diagnostics(run) {
    return structuredClone({
      scenario: run.scenario,
      time: run.time,
      pose: { x: run.x, s: run.s, yaw: run.yaw, speed: run.speed },
      objective: this.mission.objectiveId,
      route: this.follower.route,
      progress: this.follower.progress,
    });
  }
}
