import { worldFor } from '../levels/scenario.js';
import { configFor, angleDelta, clamp } from '../game/config.js';
import { airEscortSlot, carrierFor } from '../game/carrier.js';
import { hearingGoal } from './hearing.js';
import { advanceFlight, advanceYaw, advanceLift, flightFor } from './flight.js';
import { AIR_HULL, aircraftSweepClear } from './maneuver-geometry.js';
export const ESCORT_NAVIGATION = Object.freeze({
  memorySeconds: 38,
  lookAheadSeconds: 2,
  catchupSpeedMultiplier: 1.4,
  airCatchupMetersPerSecond: 8,
  perimeterClearanceMeters: 40,
});
export function returningToCarrier(e, now) {
  return (
    e.role === 'escort' &&
    !e.attack &&
    (!e.memory || e.targetGone || now - e.memory.seenAt > ESCORT_NAVIGATION.memorySeconds) &&
    !hearingGoal(e, now) &&
    now >= (e.threatUntil || 0)
  );
}
export function flyCarrierEscort(e, now, dt) {
  const world = worldFor(e),
    carrier = carrierFor(world),
    flight = flightFor(e);
  const altitude = world.WALL_HEIGHT + AIR_HULL.bottom + 10;
  const before = { x: e.x, s: e.s, y: e.y, yaw: e.yaw };
  const goal = airEscortSlot(e.escortIndex, now + ESCORT_NAVIGATION.lookAheadSeconds, world);
  e.state = 'escort';
  e.goal = goal;
  e.memory = null;
  e.canSee = false;
  e.tactical = null;
  const dx = goal.x - e.x,
    ds = goal.s - e.s,
    d = Math.hypot(dx, ds),
    yaw = -Math.atan2(dx, ds);
  // Rise above roofs before translating. A moving slot is not a stop waypoint.
  const clearHeight = e.y >= altitude - 0.5;
  advanceLift(e, dt, altitude);
  advanceYaw(e, dt, clearHeight ? yaw : null);
  const alignment = Math.max(0, Math.cos(angleDelta(e.yaw, yaw)));
  const speed = Math.hypot(e.vx, e.vs);
  const desired = clearHeight
    ? Math.min(
        carrier.speed + ESCORT_NAVIGATION.airCatchupMetersPerSecond,
        Math.max(0, (carrier.speed * dx) / (d || 1) + d * 0.5),
      ) *
      alignment *
      alignment
    : 0;
  advanceFlight(
    e,
    dt,
    desired
      ? Math.min(flight.acceleration, flight.drag * desired + Math.max(0, desired - speed) * 1.4)
      : 0,
    desired ? clamp((speed - desired) / 5, 0, 1) : 1,
  );
  if (!aircraftSweepClear(before, e, undefined, world)) {
    Object.assign(e, before, { vx: 0, vs: 0, vy: 0, yawVelocity: 0 });
  }
}
// Ground escorts skirt whole maze sites rather than chase slots inside slabs.
// Retain the selected side until the tank has cleared the site's far edge.
export function groundEscortGoal(e, slot) {
  const world = worldFor(e),
    margin =
      ESCORT_NAVIGATION.perimeterClearanceMeters + configFor(e).tankRadius + (e.index % 2) * 20;
  let detour = e.escortDetour;
  if (detour && e.x > detour.exitX - 8) {
    e.escortDetour = null;
    detour = null;
  }
  if (!detour) {
    const sites = world.MAZE_INSTANCES.filter((m) => {
      const b = m.bounds;
      return (
        e.x < b.maxX + margin - 8 &&
        slot.x > b.minX - margin &&
        slot.s > b.minS - margin &&
        slot.s < b.maxS + margin
      );
    }).sort((a, b) => a.bounds.minX - b.bounds.minX);
    const b = sites[0]?.bounds;
    if (b) {
      const side =
        Math.abs(e.s - (b.minS - margin)) <= Math.abs(e.s - (b.maxS + margin))
          ? b.minS - margin
          : b.maxS + margin;
      detour = e.escortDetour = { entryX: b.minX - margin, exitX: b.maxX + margin, s: side };
    }
  }
  if (!detour) return slot;
  if (e.x < detour.entryX - 5) return { x: detour.entryX, s: detour.s };
  return { x: detour.exitX, s: detour.s };
}
