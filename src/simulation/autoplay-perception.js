import { worldFor } from '../levels/scenario.js';
import { AUTOPLAY } from '../game/autoplay.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.s - b.s);
export function visibleAutoplayEnemies(run) {
  const { lineOfSight } = worldFor(run);
  return [...run.recognizers, ...run.enemyTanks]
    .filter(
      (e) =>
        e.health > 0 &&
        !e.teleport &&
        !['materializing', 'destroyed'].includes(e.state) &&
        distance(run, e) <= AUTOPLAY.visionMeters &&
        lineOfSight({ ...run, y: 2.8 }, { x: e.x, s: e.s, y: e.kind === 'ground' ? 2.3 : e.y + 1 }),
    )
    .map((e) => ({
      id: e.id,
      kind: e.kind || 'recognizer',
      x: e.x,
      s: e.s,
      y: e.kind === 'ground' ? 2.3 : e.y + 1,
      yaw: e.yaw,
      vx: e.vx || 0,
      vs: e.vs || 0,
      vy: e.vy || 0,
      health: e.health,
    }));
}
export function autoplayThreats(run, contacts = visibleAutoplayEnemies(run)) {
  return contacts.filter((e) => {
    const d = distance(e, run),
      closing = ((e.vx || 0) * (run.x - e.x) + (e.vs || 0) * (run.s - e.s)) / Math.max(1, d);
    return (
      d < AUTOPLAY.threatNearMeters ||
      (d < AUTOPLAY.threatApproachMeters && closing > AUTOPLAY.threatClosingMetersPerSecond)
    );
  });
}
