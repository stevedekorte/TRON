import { LIGHT_CYCLES as C, CYCLE_DIRECTIONS as DIR, cycleTrailState } from '../game/light-cycles.js';
import { arenaSite } from '../levels/arena.js';
const side=C.halfCells*2+1;
const cell=(x,z)=>(z+C.halfCells)*side+x+C.halfCells;
const inside=(x,z)=>Math.abs(x)<=C.halfCells&&Math.abs(z)<=C.halfCells;
const free=(r,x,z)=>inside(x,z)&&r.occupied[cell(x,z)]===0;
function random(r){r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;return r.seed/4294967296;}
export function createCycleRace(world,seed=1982){
  const site=arenaSite(world);
  if(!site)return null;
  const r={site,seed:seed>>>0,round:0,scores:[0,0],time:0};
  resetCycleRound(r);return r;
}
export function resetCycleRound(r){
  r.round++;r.phase='countdown';r.remaining=C.countdownSeconds;r.elapsed=0;r.accumulator=0;r.winner=null;
  r.occupied=new Uint8Array(side*side);r.trails=[];r.crashes=[];
  r.cycles=Array.from({length:6},(_,id)=>{
    const team=id<3?0:1,x=(id%3-1)*12,z=team===0?60:-60,dir=team===0?0:2;
    r.occupied[cell(x,z)]=id+1;
    return {id,team,x,z,previousX:x,previousZ:z,dir,alive:true,turns:0,straight:0};
  });
}
function room(r,x,z){
  const seen=new Set([cell(x,z)]),queue=[[x,z]];
  for(let i=0;i<queue.length&&queue.length<C.floodCells;i++){
    const [px,pz]=queue[i];
    for(const [dx,dz] of DIR){const nx=px+dx,nz=pz+dz,k=cell(nx,nz);if(free(r,nx,nz)&&!seen.has(k)){seen.add(k);queue.push([nx,nz]);}}
  }
  return queue.length;
}
export function chooseCycleDirection(r,bike){
  let best=bike.dir,bestScore=-Infinity;
  for(const d of [bike.dir,(bike.dir+1)%4,(bike.dir+3)%4]){
    const [dx,dz]=DIR[d],x=bike.x+dx,z=bike.z+dz;
    if(!free(r,x,z))continue;
    let clear=1;
    while(clear<C.lookAheadCells&&free(r,bike.x+dx*(clear+1),bike.z+dz*(clear+1)))clear++;
    const space=room(r,x,z);
    let score=Math.min(space,90)*.9+Math.min(clear,16)*.6+(d===bike.dir?5:0)+random(r)*3;
    if(space<25)score-=200;
    for(const other of r.cycles){
      if(!other.alive||other===bike)continue;
      const [ox,oz]=DIR[other.dir],distance=Math.hypot(other.x-x,other.z-z);
      if(distance<3)score-=other.team===bike.team?120:65;
      // Approach the lane ahead of opponents, while keeping friendly lanes clear.
      if(other.team!==bike.team){const aheadX=other.x+ox*6,aheadZ=other.z+oz*6;score-=Math.min(180,Math.hypot(x+dx*8-aheadX,z+dz*8-aheadZ))*.65;}
      if(x===other.x+ox&&z===other.z+oz)score-=180;
    }
    if(score>bestScore){bestScore=score;best=d;}
  }
  return best;
}
/** Simultaneous grid crossing prevents update-order advantages and tunneling. */
export function tickCycleRace(r,decide=chooseCycleDirection){
  const proposals=r.cycles.filter(b=>b.alive).map(b=>{const dir=decide(r,b),[dx,dz]=DIR[dir];return {b,dir,x:b.x+dx,z:b.z+dz};});
  const crashes=new Set();
  for(const p of proposals){
    if(!free(r,p.x,p.z))crashes.add(p.b.id);
    for(const q of proposals)if(p!==q&&p.x===q.x&&p.z===q.z){crashes.add(p.b.id);crashes.add(q.b.id);}
  }
  for(const p of proposals){
    const b=p.b;b.previousX=b.x;b.previousZ=b.z;
    if(crashes.has(b.id)){b.alive=false;r.crashes.push({id:b.id,x:b.x,z:b.z,team:b.team,time:r.time});continue;}
    if(p.dir!==b.dir){b.turns++;b.straight=0;}else b.straight++;
    const last=r.trails[b.segment];
    if(last&&last.dir===p.dir){last.x2=p.x;last.z2=p.z;}
    else{b.segment=r.trails.length;r.trails.push({bikeId:b.id,team:b.team,dir:p.dir,x1:b.x,z1:b.z,x2:p.x,z2:p.z});}
    b.x=p.x;b.z=p.z;b.dir=p.dir;r.occupied[cell(b.x,b.z)]=b.id+1;
  }
  const teams=[0,1].filter(team=>r.cycles.some(b=>b.alive&&b.team===team));
  if(teams.length<2){r.phase='result';r.remaining=C.restartSeconds;r.winner=teams[0]??null;if(r.winner!==null)r.scores[r.winner]++;}
}
export function updateCycleRace(r,dt){
  if(!r)return;
  r.time+=dt;
  for(const crash of r.crashes){
    if(crash.trailCleared||cycleTrailState(r.time-crash.time).height>0)continue;
    for(let i=0;i<r.occupied.length;i++)if(r.occupied[i]===crash.id+1)r.occupied[i]=0;
    crash.trailCleared=true;
  }
  if(r.phase!=='racing'){
    r.remaining-=dt;
    if(r.remaining<=0){if(r.phase==='result')resetCycleRound(r);else r.phase='racing';}
    return;
  }
  r.elapsed+=dt;r.accumulator+=dt;
  const interval=C.cellMeters/C.speedMetersPerSecond;
  while(r.accumulator>=interval&&r.phase==='racing'){r.accumulator-=interval;tickCycleRace(r);}
  if(r.elapsed>=C.roundSeconds&&r.phase==='racing'){
    const counts=[0,1].map(t=>r.cycles.filter(b=>b.alive&&b.team===t).length);
    r.winner=counts[0]===counts[1]?null:counts[0]>counts[1]?0:1;
    if(r.winner!==null)r.scores[r.winner]++;
    r.phase='result';r.remaining=C.restartSeconds;
  }
}
