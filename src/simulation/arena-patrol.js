import { ARENA_PATROL, arenaPatrolRoute } from '../game/arena-patrol.js';
import { configFor } from '../game/config.js';
import { worldFor } from '../levels/scenario.js';
import { hearingGoal } from './hearing.js';
import { AIR_HULL, aircraftSweepClear } from './maneuver-geometry.js';
import { advanceFlightToward, advanceLift, advanceYaw } from './flight.js';
export function returningToArena(e, now) {
  return e.role === 'arena-patrol' && !e.attack && !e.canSee &&
    (!e.memory || e.targetGone || now - e.memory.seenAt > ARENA_PATROL.memorySeconds) &&
    !hearingGoal(e, now) && now >= (e.threatUntil || 0);
}
export function flyArenaPatrol(e, now, dt) {
  const world = worldFor(e), route = arenaPatrolRoute(world);
  if (!route.length) return;
  if (!e.arenaPatrolling) {
    e.patrolWaypoint = route.reduce((best,p,i)=>Math.hypot(p.x-e.x,p.s-e.s)<Math.hypot(route[best].x-e.x,route[best].s-e.s)?i:best,0);
  }
  e.arenaPatrolling = true;
  let goal = route[e.patrolWaypoint];
  if (Math.hypot(goal.x-e.x,goal.s-e.s) < ARENA_PATROL.arrivalMeters) {
    e.patrolWaypoint = (e.patrolWaypoint + 1) % route.length;
    goal = route[e.patrolWaypoint];
  }
  e.memory = null; e.tactical = null; e.state = 'wander'; e.goal = goal;
  const altitude = Math.max(world.WALL_HEIGHT, ARENA_PATROL.wallHeightMeters) + AIR_HULL.bottom + ARENA_PATROL.soleClearanceMeters;
  const before = {x:e.x,s:e.s,y:e.y,yaw:e.yaw};
  const dx=goal.x-e.x,ds=goal.s-e.s,distance=Math.hypot(dx,ds);
  const clear = e.y >= altitude - 0.5;
  advanceLift(e,dt,altitude);
  advanceYaw(e,dt,clear ? -Math.atan2(dx,ds) : null);
  advanceFlightToward(e,dt,dx,ds,clear ? Math.min(configFor(e).enemySpeed*ARENA_PATROL.speedMultiplier,distance*.6) : 0);
  if (!aircraftSweepClear(before,e,undefined,world)) Object.assign(e,before,{vx:0,vs:0,vy:0,yawVelocity:0});
}
