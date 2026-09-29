import { arenaSite } from '../levels/arena.js';
import { config, RECOGNIZER_SCALE } from './config.js';
export const ARENA_PATROL = Object.freeze({
  wallCenterHalfExtentMeters: 450,
  wallHeightMeters: 60,
  soleClearanceMeters: 8,
  arrivalMeters: 12,
  speedMultiplier: 0.57,
  memorySeconds: 38,
  entryXOffsetMeters: -442,entryCrossingZOffsetMeters: 320,entryCrossingSeconds:3,
  entryTrailMeters:24,
});
export function arenaPatrolRoute(world) {
  const site = arenaSite(world);
  if (!site) return [];
  const h = ARENA_PATROL.wallCenterHalfExtentMeters;
  return [[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,s])=>({x:site.x+x,s:site.s+s}));
}
export function arenaPatrolStart(world) {
  const route = arenaPatrolRoute(world);
  const site=arenaSite(world);
  const speed=config.enemySpeed*ARENA_PATROL.speedMultiplier;
  return route.length ? { x:site.x+ARENA_PATROL.entryXOffsetMeters,s:site.s-ARENA_PATROL.entryCrossingZOffsetMeters+speed*ARENA_PATROL.entryCrossingSeconds+ARENA_PATROL.entryTrailMeters,
    role: 'arena-patrol', patrolWaypoint: 0, arenaPatrolling:true,
    y: ARENA_PATROL.wallHeightMeters + 22 * RECOGNIZER_SCALE + ARENA_PATROL.soleClearanceMeters,
    yaw: Math.PI,vs:-speed } : null;
}
