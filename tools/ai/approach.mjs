// Offline reward instrumentation. Never imported by the game or authority.
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
import {ARENA_WALL} from '../../shared/simulation/config/arena-breaches.js';
import {cycleCollisionTrails,sweepCycleSegment} from '../../shared/simulation/cycle-continuous.js';

export const APPROACH=Object.freeze({version:1,sampleSeconds:1,gridStepMeters:2.4,
 nearMeters:20,farMeters:120,pairCap:1,teamCap:1});
const directions=[[1,0],[0,1],[-1,0],[0,-1]];

// Cardinal route graph with swept-disc edges, rather than occupied-cell flags:
// even a thin trail between two free nodes blocks the connecting edge.
// Coordinates here use arena cells. Conservative discretization may miss narrow
// passages; an unreachable/invalid endpoint earns nothing, never Euclidean credit.
export class ApproachGraph{
 constructor(barriers,{step=APPROACH.gridStepMeters/C.cellMeters,
  edge=(ARENA_WALL.innerMeters-ARENA_WALL.cycleRadiusMeters)/C.cellMeters,
  radius=ARENA_WALL.cycleRadiusMeters/C.cellMeters}={}){
  this.barriers=barriers;this.step=step;this.radius=radius;this.half=Math.floor(edge/step);
  this.side=2*this.half+1;this.edges=new Uint8Array(this.side**2);
  this.queue=new Int32Array(this.edges.length);
  for(const {a,end} of barriers){
   const x0=Math.max(0,Math.floor(Math.min(a.x,end.x)/step+this.half-radius/step)-1);
   const x1=Math.min(this.side-1,Math.ceil(Math.max(a.x,end.x)/step+this.half+radius/step)+1);
   const z0=Math.max(0,Math.floor(Math.min(a.z,end.z)/step+this.half-radius/step)-1);
   const z1=Math.min(this.side-1,Math.ceil(Math.max(a.z,end.z)/step+this.half+radius/step)+1);
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(let d=0;d<2;d++){
    const [dx,dz]=directions[d],nx=x+dx,nz=z+dz;if(nx>=this.side||nz>=this.side)continue;
    const key=z*this.side+x,next=nz*this.side+nx;
    if((this.edges[key]&(1<<d))||!sweepCycleSegment(this.point(key),this.point(next),a,end,radius))continue;
    this.edges[key]|=1<<d;this.edges[next]|=1<<(d+2);
   }
  }
 }
 point(key){return {x:(key%this.side-this.half)*this.step,z:(Math.floor(key/this.side)-this.half)*this.step};}
 connectors(p){
  const bound=this.half*this.step;
  if(Math.abs(p.x)>bound||Math.abs(p.z)>bound)return [];
  const x=Math.round(p.x/this.step)+this.half,z=Math.round(p.z/this.step)+this.half,links=[];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.side||nz>=this.side)continue;
   const key=nz*this.side+nx,q=this.point(key);
   if(this.barriers.some(({a,end})=>sweepCycleSegment(p,q,a,end,this.radius)))continue;
   links.push({key,distance:Math.hypot(q.x-p.x,q.z-p.z)});
  }
  return links.sort((a,b)=>a.distance-b.distance);
 }
 field(target){
  const start=this.connectors(target)[0];if(!start)return null;
  const distance=new Int32Array(this.edges.length);distance.fill(-1);
  let read=0,count=1;this.queue[0]=start.key;distance[start.key]=0;
  while(read<count){
   const key=this.queue[read++],x=key%this.side,z=Math.floor(key/this.side);
   for(let d=0;d<4;d++){
    const [dx,dz]=directions[d],nx=x+dx,nz=z+dz;
    if(nx<0||nz<0||nx>=this.side||nz>=this.side||(this.edges[key]&(1<<d)))continue;
    const next=nz*this.side+nx;if(distance[next]>=0)continue;
    distance[next]=distance[key]+1;this.queue[count++]=next;
   }
  }
  return {distance,offset:start.distance};
 }
 distance(field,links){
  if(!field)return Infinity;
  let best=Infinity;
  for(const {key,distance} of links)if(field.distance[key]>=0)
   best=Math.min(best,field.distance[key]*this.step+field.offset+distance);
  return best*C.cellMeters;
 }
}

export class ApproachRewards{
 constructor(teamCount){this.scores=Array(teamCount).fill(0);this.opportunities=Array(teamCount).fill(1);this.pairs=new Map();this.previous=null;this.samples=0;}
 // Same frozen target and geometry for both positions excludes passive target
 // approach, wall removal, or trail growth from the credited distance change.
 record(owner,target,beforeMeters,afterMeters){
  if(owner.team===target.team||!Number.isFinite(beforeMeters)||!Number.isFinite(afterMeters))return;
  const key=`${owner.id}:${target.id}`;
  const pair=this.pairs.get(key)??{net:0,best:0};
  const potential=d=>Math.max(0,Math.min(1,(APPROACH.farMeters-d)/(APPROACH.farMeters-APPROACH.nearMeters)));
  pair.net+=potential(afterMeters)-potential(beforeMeters);
  const best=Math.min(APPROACH.pairCap,Math.max(pair.best,pair.net));
  this.scores[owner.team]=Math.min(APPROACH.teamCap,this.scores[owner.team]+(best-pair.best)/this.opportunities[owner.team]);
  pair.best=best;this.pairs.set(key,pair);
 }
 sample(race){
  const alive=race.cycles.filter(b=>b.alive&&!b.escaped);
  const current=new Map(alive.map(b=>[b.id,{id:b.id,team:b.team,x:b.x,z:b.z}]));
  // Fixed initial denominator: deaths cannot inflate remaining approach credit.
  if(!this.previous)for(let team=0;team<this.scores.length;team++)
   this.opportunities[team]=Math.max(1,alive.filter(b=>b.team===team).length*alive.filter(b=>b.team!==team).length);
  const currentGraph=new ApproachGraph(cycleCollisionTrails(race));
  if(this.previous){
   const graph=this.previousGraph;
   const links=new Map(alive.map(b=>[b.id,{before:this.previous.has(b.id)?graph.connectors(this.previous.get(b.id)):[],after:graph.connectors(b),current:currentGraph.connectors(b)}]));
   for(const target of alive){
    const previousTarget=this.previous.get(target.id);if(!previousTarget)continue;
    const field=graph.field(previousTarget);
    const reachable=currentGraph.field(target);
    for(const owner of alive){
     if(owner.team===target.team||!this.previous.has(owner.id))continue;
     const positions=links.get(owner.id);
     if(!Number.isFinite(currentGraph.distance(reachable,positions.current)))continue;
     this.record(owner,target,graph.distance(field,positions.before),graph.distance(field,positions.after));
    }
   }
   this.samples++;
  }
  this.previous=current;
  this.previousGraph=currentGraph;
 }
}
