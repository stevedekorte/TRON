import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR,cycleFraction,cycleTrailState} from '../game/light-cycles.js';
import {ARENA_WALL,arenaWallBlocked,wallImpact,breachContains} from '../game/arena-breaches.js';
import {cycleTrailHeadTrim} from '../game/cycle-trails.js';
import {damageCycleTrail} from './cycle-trail-damage.js';
import {rebuildTrailOccupancy} from './cycle-trails.js';
import {enterRoadMode} from './cycle-road.js';

const radius=ARENA_WALL.cycleRadiusMeters/C.cellMeters;
const point=(b,r)=>{const f=cycleFraction(r,b);return {x:b.previousX+(b.x-b.previousX)*f,z:b.previousZ+(b.z-b.previousZ)*f};};
const project=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return {x:a.x+dx*t,z:a.z+dz*t};};
/** Earliest swept-disc contact with a segment, including its circular end caps. */
export function sweepCycleSegment(from,to,a,b,r=radius){
 if(Math.max(from.x,to.x)+r<Math.min(a.x,b.x)||Math.min(from.x,to.x)-r>Math.max(a.x,b.x)||Math.max(from.z,to.z)+r<Math.min(a.z,b.z)||Math.min(from.z,to.z)-r>Math.max(a.z,b.z))return null;
 const dx=to.x-from.x,dz=to.z-from.z,ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez);
 const initial=project(from,a,b);
 if(Math.hypot(from.x-initial.x,from.z-initial.z)<=r)return {t:0,...initial};
 let hit=Infinity;
 for(const p of [a,b]){
  const x=from.x-p.x,z=from.z-p.z,A=dx*dx+dz*dz,B=2*(x*dx+z*dz),D=B*B-4*A*(x*x+z*z-r*r);
  if(A&&D>=0){const t=(-B-Math.sqrt(D))/(2*A);if(t>=0&&t<=1)hit=Math.min(hit,t);}
 }
 if(len){
  const nx=-ez/len,nz=ex/len,offset=(from.x-a.x)*nx+(from.z-a.z)*nz,velocity=dx*nx+dz*nz;
  if(velocity)for(const side of [-r,r]){
   const t=(side-offset)/velocity,along=((from.x+dx*t-a.x)*ex+(from.z+dz*t-a.z)*ez)/len;
   if(t>=0&&t<=1&&along>=0&&along<=len)hit=Math.min(hit,t);
  }
 }
 if(hit===Infinity)return null;
 return {t:hit,...project({x:from.x+dx*hit,z:from.z+dz*hit},a,b)};
}
export function continuousCycle(r,b){
 if(b.continuousArena)return;
 const p=point(b,r),tail=r.trails[b.segment];
 if(tail){tail.x2=p.x;tail.z2=p.z;}
 r.continuousTrails=true;
 b.x=b.previousX=p.x;b.z=b.previousZ=p.z;b.progress=1;b.continuousArena=true;
 rebuildTrailOccupancy(r,[b]);
}
export function turnContinuousCycle(r,b,turn){
 if(!turn)return;
 b.dir=(b.dir+Math.sign(turn)+4)%4;b.turns++;b.straight=0;
 // Open a segment even for two turns separated by a tiny distance.
 b.segment=undefined;
}
function mark(r,x,z,id){
 x=Math.round(x);z=Math.round(z);
 if(Math.abs(x)<=C.halfCells&&Math.abs(z)<=C.halfCells){const i=(z+C.halfCells)*(2*C.halfCells+1)+x+C.halfCells;if(!r.occupied[i]||r.occupied[i]===id)r.occupied[i]=id;}
 else {const k=`${x},${z}`;if(!r.outerOccupied[k]||r.outerOccupied[k]===id)r.outerOccupied[k]=id;}
}
function retireTrail(r,b){
 const tail=r.trails[b.segment];
 if(tail){const length=Math.hypot(tail.x2-tail.x1,tail.z2-tail.z1),trim=Math.min(length,C.lengthMeters*.347/C.cellMeters);if(length){tail.x2-=(tail.x2-tail.x1)*trim/length;tail.z2-=(tail.z2-tail.z1)*trim/length;}}
 for(const t of r.trails)if(t.bikeId===b.id)t.dyingAt=Math.min(t.dyingAt??Infinity,r.time);
 b.trailStopped=true;b.segment=-1;rebuildTrailOccupancy(r,[b]);
}
export function cycleCollisionTrails(r){
 const visible=[];
 for(const owner of r.cycles){
  const crash=r.crashes.find(c=>c.id===owner.id);
  if(crash&&cycleTrailState(r.time-crash.time).height<=0)continue;
  let trim=cycleTrailHeadTrim(r,owner);
  for(let i=r.trails.length-1;i>=0;i--){
   const trail=r.trails[i];if(trail.bikeId!==owner.id)continue;
   if(trail.dyingAt!==undefined&&cycleTrailState(r.time-trail.dyingAt).height<=0)continue;
   const a={x:trail.x1,z:trail.z1},end={x:trail.x2,z:trail.z2},length=Math.hypot(end.x-a.x,end.z-a.z)*C.cellMeters;
   if(trim>=length){trim-=length;if(trail.startsRun)trim=0;continue;}
   if(length){end.x-=(end.x-a.x)*trim/length;end.z-=(end.z-a.z)*trim/length;}trim=0;
   visible.push({trail,a,end});
  }
 }
 return visible;
}

/** All proposals are tested before mutation, including relative body motion. */
export function advanceContinuousCycles(r,alive,dt,world){
 const proposals=alive.map(b=>{const [dx,dz]=DIR[b.dir],from={x:b.x,z:b.z},distance=dt*b.travelRate;return {b,from,to:{x:b.x+dx*distance,z:b.z+dz*distance},hit:null};});
 const barriers=cycleCollisionTrails(r);
 const setHit=(p,hit)=>{if(hit&&(!p.hit||hit.t<p.hit.t))p.hit=hit;};
 for(const p of proposals){
  const {b,from,to}=p;
  // Bounded samples resolve the thick arena wall and irregular breach mouths;
  // one sample spans no more than half a bike radius, even at turbo speed.
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/(radius*.5)));
  for(let i=1;i<=steps;i++){
   const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
   if(arenaWallBlocked(r,x,z)){setHit(p,{t,wall:true,x,z});break;}
  }
  if(world&&Math.max(Math.abs(to.x),Math.abs(to.z))*C.cellMeters>ARENA_WALL.outerMeters){
   const a={x:r.site.x+from.x*C.cellMeters,s:r.site.s-from.z*C.cellMeters,y:1},z={x:r.site.x+to.x*C.cellMeters,s:r.site.s-to.z*C.cellMeters,y:1};
   if(world.wallIntersection(a,z,ARENA_WALL.cycleRadiusMeters)!==null)setHit(p,{t:0});
  }
  for(const {trail,a,end} of barriers){
   if(trail.bikeId===b.id){
    const near=project(from,a,end),far=project(to,a,end),d0=Math.hypot(from.x-near.x,from.z-near.z),d1=Math.hypot(to.x-far.x,to.z-far.z);
    // Depart a fresh corner without colliding with the wall just emitted.
    if(d0<=radius+1e-8&&d1>d0+1e-9)continue;
   }
   const hit=sweepCycleSegment(from,to,a,end);
   if(hit)setHit(p,{...hit,owner:trail.bikeId});
  }
 }
 // Moving bodies: relative swept circles avoid both update-order advantage
 // and head-on tunneling when two cycles enter the same space in this step.
 for(let i=0;i<proposals.length;i++)for(let j=i+1;j<proposals.length;j++){
  const p=proposals[i],q=proposals[j];
  const hit=sweepCycleSegment({x:p.from.x-q.from.x,z:p.from.z-q.from.z},{x:p.to.x-q.to.x,z:p.to.z-q.to.z},{x:0,z:0},{x:0,z:0},radius*2);
  if(hit&&hit.t<=(p.hit?.t??1)&&hit.t<=(q.hit?.t??1)){setHit(p,{t:hit.t});setHit(q,{t:hit.t});}
 }
 const trailHits=[];
 for(const p of proposals){
  const {b,from,to,hit}=p,t=hit?.t??1;
  b.previousX=from.x;b.previousZ=from.z;b.x=from.x+(to.x-from.x)*t;b.z=from.z+(to.z-from.z)*t;b.progress=1;
  if(!b.trailStopped){
   let tail=r.trails[b.segment];
   if(!tail||tail.dir!==b.dir||tail.dyingAt!==undefined){b.segment=r.trails.length;tail={bikeId:b.id,team:b.team,dir:b.dir,x1:from.x,z1:from.z,x2:from.x,z2:from.z};r.trails.push(tail);}
   tail.x2=b.x;tail.z2=b.z;tail.initial=false;
   mark(r,from.x,from.z,b.id+1);mark(r,b.x,b.z,b.id+1);
  }
  if(hit){
   b.alive=false;r.crashes.push({id:b.id,x:b.x,z:b.z,team:b.team,dir:b.dir,time:r.time});
   if(hit.wall)r.breaches.push({...wallImpact(hit.x*C.cellMeters,hit.z*C.cellMeters),id:r.breaches.length,time:r.time});
   if(hit.owner!==undefined&&hit.owner!==b.id)trailHits.push(hit);
   continue;
  }
  const mouth=wallImpact(b.x*C.cellMeters,b.z*C.cellMeters);
  if(!b.trailStopped&&Math.max(Math.abs(b.x),Math.abs(b.z))>Math.max(Math.abs(from.x),Math.abs(from.z))&&Math.max(Math.abs(b.x),Math.abs(b.z))*C.cellMeters+C.lengthMeters/2>=ARENA_WALL.innerMeters&&r.breaches.some(g=>g.axis===mouth.axis&&g.sign===mouth.sign&&breachContains(g,mouth.along)))retireTrail(r,b);
  if(Math.max(Math.abs(b.x),Math.abs(b.z))*C.cellMeters>ARENA_WALL.outerMeters+ARENA_WALL.cycleRadiusMeters){
   b.previousX=b.x;b.previousZ=b.z;enterRoadMode(b);b.continuousArena=false;
   rebuildTrailOccupancy(r,[b]);if(b.id===r.playerId)r.pendingTurns=[];
  }
 }
 for(const hit of trailHits)damageCycleTrail(r,hit.owner,hit.x,hit.z);
 const teams=[0,1].filter(team=>r.cycles.some(b=>b.alive&&b.team===team));
 if(teams.length<2){r.phase='result';r.remaining=C.restartSeconds;r.winner=teams[0]??null;if(r.winner!==null)r.scores[r.winner]++;}
}
