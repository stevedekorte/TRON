import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR} from '../config/light-cycles.js';
import {ARENA_WALL} from '../config/arena-breaches.js';
import {cycleCollisionTrails,sweepCycleSegment} from '../cycle-continuous.js';
import {AI_LIMITS as L} from './config.js';
const radius=ARENA_WALL.cycleRadiusMeters/C.cellMeters,edge=(ARENA_WALL.innerMeters-ARENA_WALL.cycleRadiusMeters)/C.cellMeters;
const width=Math.ceil((C.halfCells*2+2)/L.bucketCells),bucket=x=>Math.max(0,Math.min(width-1,Math.floor((x+C.halfCells+1)/L.bucketCells)));
function distance2(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/len)):0;return (x-a.x-dx*t)**2+(z-a.z-dz*t)**2;}
export class ArenaQueries{
 constructor(){
  this.head=new Int32Array(width*width);this.next=new Int32Array(L.maxLinks);this.ids=new Int32Array(L.maxLinks);this.seen=new Uint32Array(L.maxTrails);this.stamp=0;
  this.from={x:0,z:0};this.to={x:0,z:0};this.tests=0;this.overflow=false;this.barriers=[];
  this.spaceSeen=new Uint32Array((2*C.halfCells+1)**2);this.spaceQueue=new Int32Array(Math.floor(L.spaceVisits/3));this.spaceStamp=0;
 }
 rebuild(r){
  this.race=r;this.tests=0;this.overflow=false;this.head.fill(-1);let links=0;
  // This shared adapter preserves emitter trim, damage and death lifetimes.
  if(r.trails.length>L.maxTrails||r.cycles.length>C.maxCycles){this.overflow=true;this.barriers=[];return;}
  this.barriers=cycleCollisionTrails(r);
  if(this.barriers.length>L.maxTrails){this.overflow=true;return;}
  for(let i=0;i<this.barriers.length;i++){
   const {a,end:b}=this.barriers[i];
   const x0=bucket(Math.min(a.x,b.x)-radius),x1=bucket(Math.max(a.x,b.x)+radius),z0=bucket(Math.min(a.z,b.z)-radius),z1=bucket(Math.max(a.z,b.z)+radius);
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    if(links===L.maxLinks){this.overflow=true;return;}
    const cell=z*width+x;this.ids[links]=i;this.next[links]=this.head[cell];this.head[cell]=links++;
   }
  }
 }
 // Cardinal swept ray in existing arena coordinates. Unknown is blocked.
 clearance(b,dir,maxCells=L.maxRayCells,x=b.x,z=b.z){
  if(this.overflow)return 0;
  const [dx,dz]=DIR[dir],wall=dx? (edge-Math.sign(dx)*x): (edge-Math.sign(dz)*z);
  let distance=Math.max(0,Math.min(maxCells,wall));if(!distance)return 0;
  const from=this.from,to=this.to;from.x=x;from.z=z;to.x=x+dx*distance;to.z=z+dz*distance;
  const x0=bucket(Math.min(x,to.x)-radius),x1=bucket(Math.max(x,to.x)+radius),z0=bucket(Math.min(z,to.z)-radius),z1=bucket(Math.max(z,to.z)+radius);
  if(++this.stamp===0xffffffff){this.seen.fill(0);this.stamp=1;}let tested=0;
  for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++)for(let link=this.head[iz*width+ix];link>=0;link=this.next[link]){
   const id=this.ids[link];if(this.seen[id]===this.stamp)continue;this.seen[id]=this.stamp;
   if(++tested>L.segmentTestsPerQuery||++this.tests>L.segmentTestsPerTick)return 0;
   const {trail,a,end}=this.barriers[id];
   if(trail.bikeId===b.id){const near=distance2(x,z,a,end);if(near<=(radius+1e-8)**2&&distance2(to.x,to.z,a,end)>near+1e-9)continue;}
   const hit=sweepCycleSegment(from,to,a,end);if(hit)distance=Math.min(distance,hit.t*Math.hypot(to.x-x,to.z-z));
  }
  return distance;
 }
 // Conservative moving-body AND newly emitted trail forecast. Existing trails
 // are checked separately. The forecast never assumes an opponent turns away.
 trafficClearance(b,dir,seconds,speed){
  const [dx,dz]=DIR[dir],distance=speed*seconds/C.cellMeters;let free=distance;
  for(const other of this.race.cycles){
   if(other===b||!other.alive||other.escaped)continue;
   const [ox,oz]=DIR[other.dir],travel=C.speedMetersPerSecond*(other.speedMultiplier??1)*seconds/C.cellMeters;
   const hit=sweepCycleSegment({x:b.x-other.x,z:b.z-other.z},{x:b.x+dx*distance-other.x-ox*travel,z:b.z+dz*distance-other.z-oz*travel},{x:0,z:0},{x:0,z:0},radius*2);
   if(hit)free=Math.min(free,hit.t*distance);
   // Timing at a perpendicular crossing matters: a future trail isn't present yet.
   if(dx*ox+dz*oz===0){
    const ours=dx?(other.x-b.x)/dx:(other.z-b.z)/dz;
    const theirs=ox?(b.x-other.x)/ox:(b.z-other.z)/oz;
    if(ours>=0&&ours<=distance&&theirs>=0&&theirs<=travel&&theirs/(travel||1)<=ours/(distance||1))free=Math.min(free,Math.max(0,ours-radius));
   }
  }
  return free;
 }
 turnHandedness(b){
  let previous=b.dir,hand=0,turns=0;
  for(let i=this.race.trails.length-1;i>=0;i--){
   const t=this.race.trails[i];if(t.bikeId!==b.id||t.dir===undefined||t.dyingAt!==undefined||Math.hypot(t.x2-t.x1,t.z2-t.z1)<1e-6)continue;
   if(t.dir===previous)continue;
   const change=(previous-t.dir+4)%4;
   if(change!==1&&change!==3||hand&&hand!==change)return 0;
   hand=change;previous=t.dir;if(++turns===2)return hand;
  }
  return 0;
 }
 space(b,dir,clear=this.clearance(b,dir),hand=this.turnHandedness(b)){
  // Probe the reachable region AFTER laying the proposed trail. Use swept edges
  // so fractional walls cannot leak through an occupancy-only flood fill.
  this.spaceClosed=false;this.spaceTightSpiral=false;this.spaceCount=0;
  const side=2*C.halfCells+1,[dx,dz]=DIR[dir];
  const leg=Math.min(C.speedMetersPerSecond*(b.speedMultiplier??1)*L.spaceProbeSeconds/C.cellMeters,Math.max(0,clear-.5));
  if(leg<=0||this.overflow)return 0;
  const sx=b.x+dx*leg,sz=b.z+dz*leg;
  if(hand&&(dir-b.dir+4)%4===hand){
   const fourth=(dir+hand)%4,gap=C.lengthMeters*L.spiralEscapeLengths/C.cellMeters;
   this.spaceTightSpiral=this.clearance(b,fourth,gap,sx,sz)<gap-1e-8;
  }
  const tail=Math.max(0,leg-L.spaceTailGapMeters/C.cellMeters),a={x:b.x,z:b.z},end={x:b.x+dx*tail,z:b.z+dz*tail};
  const began=this.tests,from={x:0,z:0},to={x:0,z:0};
  if(++this.spaceStamp===0xffffffff){this.spaceSeen.fill(0);this.spaceStamp=1;}
  const start=C.halfCells*side+C.halfCells;let count=1;this.spaceQueue[0]=start;this.spaceSeen[start]=this.spaceStamp;
  for(let i=0;i<count&&count<this.spaceQueue.length;i++){
   const cell=this.spaceQueue[i],x=cell%side,z=Math.floor(cell/side);
   from.x=sx+x-C.halfCells;from.z=sz+z-C.halfCells;
   for(let d=0;d<4&&count<this.spaceQueue.length;d++){
    const nx=x+DIR[d][0],nz=z+DIR[d][1];if(nx<0||nz<0||nx>=side||nz>=side)continue;
    const key=nz*side+nx;if(this.spaceSeen[key]===this.spaceStamp)continue;
    if(this.tests-began>=L.spaceSegmentTests||this.tests>=L.segmentTestsPerTick-L.spaceSafetyReserveTests){this.spaceCount=count;return count/this.spaceQueue.length;}
    to.x=from.x+DIR[d][0];to.z=from.z+DIR[d][1];
    if(Math.abs(to.x)>edge||Math.abs(to.z)>edge||tail>0&&sweepCycleSegment(from,to,a,end))continue;
    if(this.clearance(b,d,1,from.x,from.z)<1-1e-8)continue;
    this.spaceSeen[key]=this.spaceStamp;this.spaceQueue[count++]=key;
   }
  }
  this.spaceCount=count;this.spaceClosed=count<L.spaceMinExitCells;
  return count/this.spaceQueue.length;
 }
}
