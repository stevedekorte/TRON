import { configFor } from '../game/config.js';
import { worldFor } from '../levels/scenario.js';
import { config, TURBO, angleDelta, clamp } from '../game/config.js';
import { AUTOPLAY } from '../game/autoplay.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.s - b.s);
/** Executes a versioned route. Planning and network responses cannot write its cursor. */
export class RouteFollower {
  #index = 0;
  get index() {
    return this.#index;
  }
  constructor() {
    this.reset();
  }
  reset() {
    this.route = null;
    this.#index = 0;
    this.turningInPlace = false;
    this.progress = null;
    this.lastProgress = null;
  }
  accept(plan, revision, run) {
    const id = `${worldFor(run).revision}:${revision}:${plan.id}:${run.teleportRevision}`;
    if (this.route?.id === id) return;
    this.route = {
      id,
      worldRevision: worldFor(run).revision,
      objectiveId: plan.kind === 'collect-data' ? plan.goal : null,
      planKind: plan.kind,
      waypoints: plan.route.map((p, i) => ({
        ...p,
        kind:
          i < plan.route.length - 1
            ? 'corner'
            : ['collect-data', 'hold'].includes(plan.kind)
              ? 'stop'
              : 'passThrough',
      })),
    };
    this.#index = 0;
    this.origin = { x: run.x, s: run.s };
    this.lastProgress = { x: run.x, s: run.s, time: run.time };
  }
  needsContinuation(run, started) {
    const config = configFor(run);
    if (!this.route) return true;
    const { waypoints: path, planKind } = this.route,
      speed = Math.max(0, run.speed),
      stopping = Math.max(4, (speed * speed) / (2 * config.braking) + 2);
    return (
      this.#index === path.length - 1 &&
      !['collect-data', 'hold'].includes(planKind) &&
      distance(run, path[this.#index]) <
        stopping + Math.max(AUTOPLAY.arrivalMeters, speed * AUTOPLAY.continuationLeadSeconds) &&
      run.time - started >= AUTOPLAY.minPlanSeconds
    );
  }
  update(run) {
    const config = configFor(run);
    if (!this.route || this.route.worldRevision !== worldFor(run).revision)
      return { status: 'needsReplan', command: {}, distance: 0, heading: run.yaw };
    const clear = (a, b) =>
      worldFor(run).wallIntersection({ ...a, y: 2 }, { ...b, y: 2 }, config.tankRadius + 0.5) ===
      null;
    const path = this.route.waypoints,
      plan = { kind: this.route.planKind };
    const speed = Math.max(0, run.speed),
      stopping = Math.max(4, (speed * speed) / (2 * config.braking) + 2);
    const reach = Math.max(AUTOPLAY.arrivalMeters, speed * AUTOPLAY.waypointLeadSeconds);
    while (this.#index < path.length - 1) {
      const point = path[this.#index],
        previous = this.#index ? path[this.#index - 1] : this.origin;
      const passed =
        (run.x - point.x) * (point.x - previous.x) + (run.s - point.s) * (point.s - previous.s) >=
        0;
      if ((distance(run, point) >= reach && !passed) || !clear(run, path[this.#index + 1])) break;
      this.#index++;
    }
    // Consume visible waypoints continuously, not only at three-second replans.
    for (let i = path.length - 1; i > this.#index; i--)
      if (clear(run, path[i])) {
        this.#index = i;
        break;
      }
    const goal = path[this.#index],
      d = distance(run, goal),
      heading = -Math.atan2(goal.x - run.x, goal.s - run.s),
      error = angleDelta(run.yaw, heading);
    const boostedSpeed = config.maxSpeed * TURBO.speedMultiplier;
    const turboRunway =
      boostedSpeed * TURBO.duration + (boostedSpeed * boostedSpeed) / (2 * config.braking);
    const turbo =
      run.turboCooldown <= 0 &&
      run.speed >= AUTOPLAY.turboMinSpeed &&
      !run.transferActive &&
      d > turboRunway &&
      Math.abs(error) < AUTOPLAY.turboHeadingRadians &&
      clear(run, goal);
    const maxSpeed =
      config.maxSpeed * (run.turboRemaining > 0 || turbo ? TURBO.speedMultiplier : 1);
    let desiredSpeed = maxSpeed * clamp(1 - Math.abs(error) / AUTOPLAY.turnSlowdownRadians, 0, 1);
    if (this.#index < path.length - 1) {
      const next = path[this.#index + 1],
        nextHeading = -Math.atan2(next.x - goal.x, next.s - goal.s);
      const cornerSpeed =
        maxSpeed *
        clamp(1 - Math.abs(angleDelta(heading, nextHeading)) / AUTOPLAY.turnSlowdownRadians, 0, 1);
      desiredSpeed = Math.min(
        desiredSpeed,
        Math.sqrt(cornerSpeed * cornerSpeed + 2 * config.braking * Math.max(0, d)),
      );
    } else
      desiredSpeed = Math.min(desiredSpeed, Math.sqrt(2 * config.braking * Math.max(0, d - 2)));
    const intermediate = goal.kind !== 'stop' && this.#index < path.length - 1;
    if (intermediate && d < AUTOPLAY.cornerCreepMeters)
      desiredSpeed = Math.min(desiredSpeed, AUTOPLAY.cornerCreepSpeed);
    if (Math.abs(error) > AUTOPLAY.turnBrakeRadians) this.turningInPlace = true;
    else if (Math.abs(error) < AUTOPLAY.turnResumeRadians) this.turningInPlace = false;
    if (this.turningInPlace) desiredSpeed = 0;
    const ahead = {
      x: run.x - Math.sin(run.yaw) * Math.min(stopping, d),
      s: run.s + Math.cos(run.yaw) * Math.min(stopping, d),
    };
    if (run.transferActive || plan.kind === 'hold' || !clear(run, ahead)) desiredSpeed = 0;

    const blocked = !clear(run, ahead);
    if (distance(run, this.lastProgress) > 0.25) {
      this.lastProgress = { x: run.x, s: run.s, time: run.time };
    }
    this.progress = {
      routeId: this.route.id,
      waypoint: this.#index,
      headingError: error,
      targetSpeed: desiredSpeed,
      secondsWithoutProgress: run.time - this.lastProgress.time,
      blockedSegment: blocked ? { from: { x: run.x, s: run.s }, to: ahead } : null,
      status: blocked
        ? 'blocked'
        : !intermediate && d <= 2 && Math.abs(run.speed) < 0.5
          ? 'arrived'
          : 'following',
    };
    const drive =
      run.speed > desiredSpeed + AUTOPLAY.speedBand
        ? -1
        : run.speed < desiredSpeed - AUTOPLAY.speedBand
          ? 1
          : 0;
    return {
      ...this.progress,
      distance: d,
      heading,
      command: {
        turbo,
        throttle: drive,
        steer:
          d > (intermediate ? AUTOPLAY.cornerAimMeters : 2)
            ? -clamp(error * AUTOPLAY.turnGain, -1, 1)
            : 0,
      },
    };
  }
}
