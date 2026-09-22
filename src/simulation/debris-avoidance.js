import { configFor, clamp, TURBO } from '../game/config.js';
import { worldFor } from '../levels/scenario.js';

export const DEBRIS_AVOIDANCE = Object.freeze({
  rangeMeters: 160,
  horizonSeconds: 2.5,
  stepSeconds: 0.1,
  clearanceMeters: 2,
  tankHeightMeters: 3.5,
  snapshotLimit: 24,
});
// Only currently visible pieces enter perception; no hidden enemy state is read.
export function visibleDebris(run) {
  const world = worldFor(run);
  return (run.debris || []).filter(
    (p) =>
      Math.hypot(p.x - run.x, p.s - run.s, p.y - 2) <= DEBRIS_AVOIDANCE.rangeMeters &&
      world.lineOfSight({ x: run.x, s: run.s, y: 2.8 }, { x: p.x, s: p.s, y: Math.max(0.2, p.y) }),
  );
}
function predictedPiece(p, t) {
  const falling = !p.sleeping && p.y > p.halfHeight + 0.1;
  return {
    x: p.x + p.vx * t,
    s: p.s + p.vs * t,
    y: Math.max(p.halfHeight, p.y + p.vy * t - (falling ? 0.5 * p.gravity * t * t : 0)),
  };
}
/** Immediate steering/braking guard. Normal simulation still applies every command. */
export function avoidDebris(run, command, pieces = visibleDebris(run)) {
  if (!pieces.length || run.transferActive) return { command, active: false };
  const cfg = configFor(run),
    world = worldFor(run),
    tune = DEBRIS_AVOIDANCE;
  function risk(candidate) {
    let x = run.x,
      s = run.s,
      yaw = run.yaw,
      speed = run.speed,
      steer = run.steer || 0,
      cost = 0;
    for (let t = tune.stepSeconds; t <= tune.horizonSeconds + 1e-6; t += tune.stepSeconds) {
      const dt = tune.stepSeconds,
        boosted =
          run.turboRemaining > t ||
          (candidate.turbo && run.turboCooldown <= 0 && t < TURBO.duration);
      const previousSpeed = speed;
      let throttle = candidate.throttle || 0;
      // Braking candidates stop rather than backing blindly into another obstacle.
      if (candidate.brake && Math.abs(speed) < cfg.braking * dt) {
        speed = 0;
        throttle = 0;
      }
      if (throttle > 0)
        speed +=
          (speed < 0
            ? cfg.braking
            : cfg.acceleration * (boosted ? TURBO.accelerationMultiplier : 1)) * dt;
      else if (throttle < 0) speed -= (speed > 0 ? cfg.braking : cfg.acceleration * 0.6) * dt;
      else speed = Math.sign(speed) * Math.max(0, Math.abs(speed) - cfg.drag * dt);
      const limit = cfg.maxSpeed * (boosted ? TURBO.speedMultiplier : 1);
      speed = clamp(
        speed,
        -Math.max(cfg.reverseSpeed, -previousSpeed - cfg.braking * dt),
        Math.max(limit, previousSpeed - cfg.braking * dt),
      );
      steer += (candidate.steer - steer) * (1 - Math.exp(-8 * dt));
      yaw -=
        steer *
        cfg.steering *
        (0.65 + 0.35 * (1 - Math.min(1, Math.abs(speed) / cfg.maxSpeed))) *
        (speed < -0.5 ? -1 : 1) *
        dt;
      const nx = x - Math.sin(yaw) * speed * dt,
        ns = s + Math.cos(yaw) * speed * dt;
      if (
        world.wallIntersection({ x, s, y: 2 }, { x: nx, s: ns, y: 2 }, cfg.tankRadius + 0.5) !==
        null
      )
        return 1e6;
      x = nx;
      s = ns;
      for (const p of pieces) {
        const next = predictedPiece(p, t);
        if (next.y - p.halfHeight > tune.tankHeightMeters) continue;
        const clearance =
          Math.hypot(x - next.x, s - next.s) - p.radius - cfg.tankRadius - tune.clearanceMeters;
        if (clearance < 0) cost += (-clearance + 1) * (tune.horizonSeconds + 1 - t);
      }
    }
    return cost;
  }
  const normal = { ...command, steer: command.steer || 0 };
  if (risk(normal) === 0) return { command, active: false };
  const brake = run.speed > 0.1 ? -1 : run.speed < -0.1 ? 1 : 0;
  const options = [
    { ...normal, throttle: brake, turbo: false, brake: true },
    ...[-1, 1].flatMap((steer) => [
      { ...normal, throttle: brake, steer, turbo: false, brake: true },
      { ...normal, throttle: 1, steer, turbo: false },
    ]),
  ];
  const scored = options
    .map((c, i) => ({ c, score: risk(c), i }))
    .sort((a, b) => a.score - b.score || a.i - b.i);
  const { brake: unused, ...chosen } = scored[0].c;
  // Stop the brake command at rest; do not introduce reversing oscillations.
  if (scored[0].c.brake && Math.abs(run.speed) < 0.4) chosen.throttle = 0;
  return { command: chosen, active: true };
}
