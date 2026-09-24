import { arenaSite } from '../levels/arena.js';
import { RECOGNIZER_SCALE } from './config.js';
export const ARENA_PATROL = Object.freeze({
  wallCenterHalfExtentMeters: 450,
  wallHeightMeters: 60,
  soleClearanceMeters: 8,
  arrivalMeters: 12,
  speedMultiplier: 0.57,
  memorySeconds: 38,
});
export function arenaPatrolRoute(world) {
  const site = arenaSite(world);
  if (!site) return [];
  const h = ARENA_PATROL.wallCenterHalfExtentMeters;
  return [[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,s])=>({x:site.x+x,s:site.s+s}));
}
export function arenaPatrolStart(world) {
  const route = arenaPatrolRoute(world);
  return route.length ? { ...route[0], role: 'arena-patrol', patrolWaypoint: 1,
    y: ARENA_PATROL.wallHeightMeters + 22 * RECOGNIZER_SCALE + ARENA_PATROL.soleClearanceMeters,
    yaw: -Math.PI / 2 } : null;
}
