import {cycleReactionProfile} from './cycle-reaction.js';
import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR} from './config/light-cycles.js';
import {ARENA_WALL,arenaWallBlocked} from './config/arena-breaches.js';
import {cycleCollisionTrails,sweepCycleSegment} from './cycle-continuous.js';

// Safety is evaluated only on a team's reaction tick, using continuous geometry.
export function cycleReactionClearance(r,b,dir,barriers=cycleCollisionTrails(r)){
 const seconds=(b.reactionDelaySeconds??cycleReactionProfile(b).meanSeconds)+C.aiSafetyMarginSeconds;
 const rate=C.speedMetersPerSecond/C.cellMeters*Math.max(1,b.speedMultiplier??1,b.boosting?C.turboSpeedMultiplier:1);
 const distance=rate*seconds,from={x:b.x,z:b.z},[dx,dz]=DIR[dir];
 const to={x:b.x+dx*distance,z:b.z+dz*distance};
 let fraction=1;
 const radius=ARENA_WALL.cycleRadiusMeters/C.cellMeters;
 const steps=Math.ceil(distance/(radius*.5));
 for(let i=1;i<=steps;i++)if(arenaWallBlocked(r,from.x+dx*distance*i/steps,from.z+dz*distance*i/steps)){fraction=(i-1)/steps;break;}
 for(const {trail,a,end} of barriers){
  const hit=sweepCycleSegment(from,to,a,end);
  if(!hit)continue;
  if(trail.bikeId===b.id&&hit.t===0){
   // Match collision's exemption for departing a freshly emitted corner.
   const ex=end.x-a.x,ez=end.z-a.z,len=ex*ex+ez*ez;
   const gap=p=>{const t=len?Math.max(0,Math.min(1,((p.x-a.x)*ex+(p.z-a.z)*ez)/len)):0;return Math.hypot(p.x-a.x-ex*t,p.z-a.z-ez*t);};
   if(gap(to)>gap(from)+1e-9)continue;
  }
  fraction=Math.min(fraction,hit.t);
 }
 for(const other of r.cycles){
  if(other===b||!other.alive||other.escaped)continue;
  const [ox,oz]=DIR[other.dir],travel=C.speedMetersPerSecond/C.cellMeters*(other.speedMultiplier??1)*seconds;
  const hit=sweepCycleSegment({x:from.x-other.x,z:from.z-other.z},{x:to.x-other.x-ox*travel,z:to.z-other.z-oz*travel},{x:0,z:0},{x:0,z:0},radius*2);
  if(hit)fraction=Math.min(fraction,hit.t);
 }
 return fraction;
}
