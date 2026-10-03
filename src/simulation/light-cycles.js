import {cycleWallContact} from './cycle-wall-contact.js';
import {trimCycleTrails} from './cycle-trails.js';
import {enterRoadMode,advanceRoadCycle,setRoadSpeedControl} from './cycle-road.js';
import {ARENA_WALL,arenaWallBlocked,wallImpact} from '../game/arena-breaches.js';
import { LIGHT_CYCLES as C, CYCLE_JEV, CYCLE_TESTING, CYCLE_DIRECTIONS as DIR, cycleTrailState, cycleFraction } from '../game/light-cycles.js';
import { arenaSite } from '../levels/arena.js';
const raceWorlds=new WeakMap();
export const attachCycleWorld=(race,world)=>raceWorlds.set(race,world);
const side=C.halfCells*2+1;
const cell=(x,z)=>(z+C.halfCells)*side+x+C.halfCells;
const inside=(x,z)=>Math.abs(x)<=C.halfCells&&Math.abs(z)<=C.halfCells;
const occupant=(r,x,z)=>inside(x,z)?r.occupied[cell(x,z)]:(r.outerOccupied?.[`${x},${z}`]??0);
const outsideClear=(r,x,z)=>{
 if(Math.max(Math.abs(x),Math.abs(z))*C.cellMeters<ARENA_WALL.outerMeters)return true;
 const world=raceWorlds.get(r);if(!world)return true;
 const p={x:r.site.x+x*C.cellMeters,s:r.site.s-z*C.cellMeters,y:1};
 return world.wallIntersection(p,p,ARENA_WALL.cycleRadiusMeters)===null;
};
export const cycleCellFree=(r,x,z)=>!arenaWallBlocked(r,x,z)&&occupant(r,x,z)===0&&outsideClear(r,x,z);
const free=cycleCellFree;
// Teammates conserve boost until racing a nearby opponent in the same direction.
function hasTurboReason(r,b){
 const player=r.cycles.find(c=>c.id===r.playerId);
 if(!player||b.team!==player.team)return true;
 const [fx,fz]=b.escaped?[-Math.sin(b.yaw),-Math.cos(b.yaw)]:DIR[b.dir];
 const lead=b.boosting?C.teammateTurboReleaseLeadMeters:C.teammateTurboLeadMeters;
 return r.cycles.some(other=>{
  if(!other.alive||other.team===b.team||!!other.escaped!==!!b.escaped)return false;
  const [ox,oz]=other.escaped?[-Math.sin(other.yaw),-Math.cos(other.yaw)]:DIR[other.dir];
  if(fx*ox+fz*oz<C.teammateRaceHeadingDot)return false;
  const dx=(other.x-b.x)*C.cellMeters,dz=(other.z-b.z)*C.cellMeters;
  return Math.hypot(dx,dz)<=C.teammateRaceRangeMeters&&Math.abs(dx*fz-dz*fx)<=C.teammateRaceLaneMeters&&dx*fx+dz*fz>=-lead;
 });
}
function random(r){r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;return r.seed/4294967296;}
export function createCycleRace(world,seed=1982){
  const site=arenaSite(world);
  if(!site)return null;
  const r={site,seed:seed>>>0,round:0,scores:[0,0],time:0};
  raceWorlds.set(r,world);resetCycleRound(r);return r;
}
export function resetCycleRound(r){
  r.arenaPaused=false;r.attemptResolved=false;r.pendingTurns=[];r.round++;r.phase='countdown';r.remaining=C.countdownSeconds;r.elapsed=0;r.accumulator=0;r.winner=null;
  r.occupied=new Uint8Array(side*side);r.outerOccupied={};r.breaches??=[];r.trails=[];r.crashes=[];
  if((r.startWithBreach??CYCLE_TESTING.startWithBreach)&&r.playerId!==undefined&&!r.breaches.some(b=>b.axis==='z'&&b.sign===-1&&b.along===0))r.breaches.push({axis:'z',sign:-1,along:0,id:r.breaches.length,time:r.time});
  const startRow=Math.floor((ARENA_WALL.innerMeters-C.lengthMeters/2-C.startWallClearanceMeters)/C.cellMeters);
  r.cycles=Array.from({length:6},(_,id)=>{
    const team=id<3?0:1,north=r.entranceFormation?team===0:team===1;
    const x=(id%3-1)*(r.entranceFormation&&team===0?C.entranceFormationSpacingCells:12),z=north?-startRow:startRow,dir=north?2:0;
    const active=!((r.hideMiddleOpponent??CYCLE_TESTING.hideMiddleOpponent)&&r.playerId!==undefined&&id===4);
    if(active)r.occupied[cell(x,z)]=id+1;
    return {id,team,x,z,previousX:x,previousZ:z,dir,alive:active,turns:0,straight:0,progress:0,speedMultiplier:1,turboCharge:1,boosting:false,brakeCharge:1,braking:false};
  });
  if(r.startOutside&&r.playerId!==undefined){
    const b=r.cycles[r.playerId];
    r.occupied[cell(b.x,b.z)]=0;
    b.x=b.previousX=0;
    b.z=b.previousZ=-(ARENA_WALL.outerMeters+CYCLE_TESTING.outsideStartClearanceMeters)/C.cellMeters;
    b.dir=0;enterRoadMode(b);b.roadSpeed=0;b.targetRoadSpeed=0;
    r.phase='racing';r.remaining=0;r.arenaPaused=true;
  }
}
function room(r,x,z){
  const seen=new Set([`${x},${z}`]),queue=[[x,z]];
  for(let i=0;i<queue.length&&queue.length<C.floodCells;i++){
    const [px,pz]=queue[i];
    for(const [dx,dz] of DIR){const nx=px+dx,nz=pz+dz,k=`${nx},${nz}`;if(free(r,nx,nz)&&!seen.has(k)){seen.add(k);queue.push([nx,nz]);}}
  }
  return queue.length;
}
function startCycleTrails(r){
 for(const b of r.cycles){
  if(!b.alive||b.escaped)continue;
  const sign=Math.sign(b.z),wallZ=sign*ARENA_WALL.innerMeters/C.cellMeters;
  if(!sign)continue;
  b.segment=r.trails.length;
  r.trails.push({bikeId:b.id,team:b.team,dir:b.dir,x1:b.x,z1:wallZ,x2:b.x,z2:b.z,initial:true});
  for(let z=b.z+sign;Math.abs(z)<=Math.floor(Math.abs(wallZ));z+=sign){
   if(inside(b.x,z))r.occupied[cell(b.x,z)]=b.id+1;
  }
 }
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
    const goal=bike.jevGoal;
    if(goal&&r.time<goal.expiresAt&&space>=25){
      const gx=goal.x-bike.x,gz=goal.z-bike.z,distance=Math.hypot(gx,gz);
      if(distance>CYCLE_JEV.minGoalCells)score+=CYCLE_JEV.directionWeight*(dx*gx+dz*gz)/distance;
    }
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
export function tickCycleRace(r,decide=chooseCycleDirection,moving=r.cycles){
  const proposals=moving.filter(b=>b.alive&&!b.escaped).map(b=>{const dir=decide(r,b),[dx,dz]=DIR[dir];return {b,dir,x:b.x+dx,z:b.z+dz};});
  const crashes=new Set();
  for(const p of proposals){
    if(!free(r,p.x,p.z))crashes.add(p.b.id);
    const world=raceWorlds.get(r);
    if(world&&Math.max(Math.abs(p.x),Math.abs(p.z))*C.cellMeters>ARENA_WALL.outerMeters){
      const from={x:r.site.x+p.b.x*C.cellMeters,s:r.site.s-p.b.z*C.cellMeters,y:1};
      const to={x:r.site.x+p.x*C.cellMeters,s:r.site.s-p.z*C.cellMeters,y:1};
      if(world.wallIntersection(from,to,ARENA_WALL.cycleRadiusMeters)!==null)crashes.add(p.b.id);
    }
    for(const q of proposals)if(p!==q&&p.x===q.x&&p.z===q.z){crashes.add(p.b.id);crashes.add(q.b.id);}
  }
  for(const p of proposals){
    const b=p.b;b.previousX=b.x;b.previousZ=b.z;
    if(crashes.has(b.id)){
      if(arenaWallBlocked(r,p.x,p.z)){
        const hit=wallImpact(p.x*C.cellMeters,p.z*C.cellMeters);
        r.breaches.push({...hit,id:r.breaches.length,time:r.time});
      }
      b.alive=false;r.crashes.push({id:b.id,x:b.x,z:b.z,team:b.team,dir:p.dir,time:r.time});continue;}
    if(Math.max(Math.abs(b.x),Math.abs(b.z))*C.cellMeters>ARENA_WALL.outerMeters+ARENA_WALL.cycleRadiusMeters){
      enterRoadMode(b);
      const tail=r.trails[b.segment];
      if(tail){
        const trim=Math.min(C.lengthMeters/2/C.cellMeters,Math.hypot(tail.x2-tail.x1,tail.z2-tail.z1));
        tail.x2=b.x+Math.sin(b.yaw)*trim;tail.z2=b.z+Math.cos(b.yaw)*trim;
      }
      if(b.id===r.playerId)r.pendingTurns=[];
      continue;
    }
    if(p.dir!==b.dir){b.turns++;b.straight=0;}else b.straight++;
    const last=r.trails[b.segment];
    if(last&&!last.joining&&last.dir===p.dir){last.x2=p.x;last.z2=p.z;last.initial=false;}
    else{b.segment=r.trails.length;r.trails.push({bikeId:b.id,team:b.team,dir:p.dir,x1:b.x,z1:b.z,x2:p.x,z2:p.z});}
    b.x=p.x;b.z=p.z;b.dir=p.dir;if(inside(b.x,b.z))r.occupied[cell(b.x,b.z)]=b.id+1;else r.outerOccupied[`${b.x},${b.z}`]=b.id+1;

  }
  trimCycleTrails(r);
  const teams=[0,1].filter(team=>r.cycles.some(b=>b.alive&&b.team===team));
  if(teams.length<2){r.phase='result';r.remaining=C.restartSeconds;r.winner=teams[0]??null;if(r.winner!==null)r.scores[r.winner]++;}
}
export function updateCycleRace(r,dt,turn=0,turbo=false,slow=false,roadInput={}){
  if(!r||r.phase==='idle')return;
  const player=r.cycles[r.playerId];if(player?.escaped)setRoadSpeedControl(player,roadInput,r.roadConfig);
  for(const b of r.cycles){
    const f=cycleFraction(r,b);
    b.renderPrevious={x:b.previousX+(b.x-b.previousX)*f,z:b.previousZ+(b.z-b.previousZ)*f,dir:b.dir,yaw:b.yaw,lean:b.lean};
    b.renderTravel=0;
  }
  if(turn&&r.playerId!==undefined&&!r.cycles[r.playerId].escaped&&r.phase!=='result'&&r.pendingTurns.length<2)r.pendingTurns.push(Math.sign(turn));
  r.time+=dt;
  if(r.playerId!==undefined&&r.cycles[r.playerId].escaped)r.arenaPaused=true;
  for(const crash of r.crashes){
    if(crash.trailCleared||cycleTrailState(r.time-crash.time).height>0)continue;
    for(let i=0;i<r.occupied.length;i++)if(r.occupied[i]===crash.id+1)r.occupied[i]=0;
    for(const key of Object.keys(r.outerOccupied))if(r.outerOccupied[key]===crash.id+1)delete r.outerOccupied[key];
    crash.trailCleared=true;
  }
  if(r.arenaPaused){updateEscapedCycles(r,dt,roadInput,true);return;}
  if(r.phase!=='racing'){
    updateEscapedCycles(r,dt,roadInput);
    r.remaining-=dt;
    if(r.remaining<=0){if(r.phase==='result'){if(r.playerId===undefined)resetCycleRound(r);}else {r.phase='racing';startCycleTrails(r);}}
    return;
  }
  r.elapsed+=dt;r.accumulator+=dt;
  const interval=C.cellMeters/C.speedMetersPerSecond;
  r.accumulator%=interval;
  // Advance to the next crossing (or charge exhaustion), so a fast player
  // cannot tunnel through occupied cells and simultaneous arrivals stay fair.
  let remaining=dt;
  while(remaining>1e-9&&r.phase==='racing'){
    const alive=r.cycles.filter(b=>b.alive&&!b.escaped);
    let slice=Math.min(remaining,C.speedStepSeconds);
    for(const b of alive){
      let wantsTurbo=turbo,wantsBrake=slow;
      if(b.id!==r.playerId){
        const [dx,dz]=DIR[b.dir];let clear=0;
        while(clear<C.aiTurboClearCells&&free(r,b.x+dx*(clear+1),b.z+dz*(clear+1)))clear++;
        wantsBrake=clear<C.aiBrakeClearCells&&(b.braking||b.brakeCharge>=C.aiReserveStartCharge);
        wantsTurbo=hasTurboReason(r,b)&&clear>=C.aiTurboClearCells&&(b.boosting||b.turboCharge>=C.aiReserveStartCharge);
      }
      b.brakeCharge??=1;
      b.braking=wantsBrake&&b.brakeCharge>1e-9;
      b.boosting=wantsTurbo&&!wantsBrake&&b.turboCharge>1e-9;
      b.reserveTurboRequested=wantsTurbo;b.reserveBrakeRequested=wantsBrake;
      b.targetSpeedMultiplier=b.braking?C.slowSpeedMultiplier:b.boosting?C.turboSpeedMultiplier:1;
      b.travelRate=(b.speedMultiplier??1)/interval;
      slice=Math.min(slice,(1-b.progress)/b.travelRate);
      if(b.braking)slice=Math.min(slice,b.brakeCharge*C.brakeDurationSeconds);
      if(b.boosting)slice=Math.min(slice,b.turboCharge*C.turboDurationSeconds);
    }
    for(const b of alive){
      b.progress+=slice*b.travelRate;b.renderTravel+=slice*b.travelRate;
      if(b.braking){b.brakeCharge=Math.max(0,b.brakeCharge-slice/C.brakeDurationSeconds);if(b.brakeCharge<1e-9)b.brakeCharge=0;}
      else if(!b.reserveBrakeRequested)b.brakeCharge=Math.min(1,b.brakeCharge+slice/C.brakeRechargeSeconds);
      b.speedMultiplier=(b.speedMultiplier??1)+(b.targetSpeedMultiplier-(b.speedMultiplier??1))*(1-Math.exp(-C.speedResponsePerSecond*slice));
      if(b.boosting){b.turboCharge=Math.max(0,b.turboCharge-slice/C.turboDurationSeconds);if(b.turboCharge<1e-9)b.turboCharge=0;}
      else if(!b.reserveTurboRequested||b.reserveBrakeRequested)b.turboCharge=Math.min(1,b.turboCharge+slice/C.turboRechargeSeconds);
    }
    updateEscapedCycles(r,slice,roadInput);
    remaining-=slice;
    const moving=alive.filter(b=>b.progress>=1-1e-9);
    for(const b of moving)b.progress=Math.max(0,b.progress-1);
    if(moving.length)tickCycleRace(r,(race,bike)=>bike.id===race.playerId?(bike.dir+(race.pendingTurns.shift()||0)+4)%4:chooseCycleDirection(race,bike),moving);
  }
  trimCycleTrails(r);
  for(const b of r.cycles)if(!b.alive||r.phase!=='racing'||b.brakeCharge<=1e-9)b.braking=false;
  for(const b of r.cycles)if(!b.alive||r.phase!=='racing'||b.turboCharge<=1e-9)b.boosting=false;
  if(r.elapsed>=C.roundSeconds&&r.phase==='racing'){
    const counts=[0,1].map(t=>r.cycles.filter(b=>b.alive&&b.team===t).length);
    r.winner=counts[0]===counts[1]?null:counts[0]>counts[1]?0:1;
    if(r.winner!==null)r.scores[r.winner]++;
    r.phase='result';r.remaining=C.restartSeconds;
  }
}

export function cyclePlayerPose(r){
 const b=r.cycles.find(b=>b.id===r.playerId)||r.cycles[1];
 const fraction=cycleFraction(r,b);
 return {x:r.site.x+(b.previousX+(b.x-b.previousX)*fraction)*C.cellMeters,
  s:r.site.s-(b.previousZ+(b.z-b.previousZ)*fraction)*C.cellMeters,yaw:b.yaw??-b.dir*Math.PI/2};
}

function reenterArena(r,b,clear){
 // Wait until the whole bike has passed the inner face of the enclosure.
 if(Math.max(Math.abs(b.x),Math.abs(b.z))*C.cellMeters+C.lengthMeters/2>=ARENA_WALL.innerMeters)return;
 const heading=b.yaw+(b.roadSpeed<0?Math.PI:0);
 const dir=((Math.round(-heading/(Math.PI/2))%4)+4)%4,[dx,dz]=DIR[dir];
 const start={x:b.x,z:b.z},next={x:Math.round(b.x)+dx,z:Math.round(b.z)+dz};
 const blocked=clear(b,next)!==true;
 b.escaped=false;b.dir=dir;delete b.yaw;
 b.lean=0;b.cornerLean=0;b.steering=0;b.reverseGear=false;b.roadSpeed=0;b.targetRoadSpeed=0;
 b.speedMultiplier=1;b.boosting=false;b.roadEntryCell=null;b.segment=undefined;
 if(b.id===r.playerId){
  r.arenaPaused=false;r.pendingTurns=[];
  if(r.phase==='result'){r.phase='racing';r.winner=null;r.remaining=0;r.elapsed=0;}
 }
 if(blocked){b.alive=false;r.crashes.push({id:b.id,...start,team:b.team,dir,time:r.time});return;}
 // Join the nearest cardinal lane over the first span instead of teleporting
 // sideways. Subsequent endpoints lie on the normal integer collision grid.
 b.previousX=start.x;b.previousZ=start.z;b.x=next.x;b.z=next.z;b.progress=0;
 b.renderPrevious={...start,dir};b.renderTravel=0;
 b.segment=r.trails.length;
 r.trails.push({bikeId:b.id,team:b.team,dir,x1:start.x,z1:start.z,x2:next.x,z2:next.z,startsRun:true,joining:true});
 r.occupied[cell(Math.round(start.x),Math.round(start.z))]=b.id+1;
 r.occupied[cell(next.x,next.z)]=b.id+1;
}

function updateEscapedCycles(r,dt,input,playerOnly=false){
 const world=raceWorlds.get(r);
 const clear=(b,to)=>{
  const from={x:r.site.x+b.x*C.cellMeters,s:r.site.s-b.z*C.cellMeters,y:1};
  const end={x:r.site.x+to.x*C.cellMeters,s:r.site.s-to.z*C.cellMeters,y:1};
  const wallContact=world&&cycleWallContact(world,from,end,ARENA_WALL.cycleRadiusMeters);
  if(wallContact)return wallContact;
  const n=Math.max(1,Math.ceil(Math.hypot(to.x-b.x,to.z-b.z)*C.cellMeters/ARENA_WALL.cycleRadiusMeters));
  for(let i=1;i<=n;i++){
   const x=b.x+(to.x-b.x)*i/n,z=b.z+(to.z-b.z)*i/n;
   const key=`${Math.round(x)},${Math.round(z)}`,occupied=occupant(r,Math.round(x),Math.round(z));
   if(arenaWallBlocked(r,x,z)){
    const axis=Math.abs(x)>Math.abs(z)?'x':'z';return {normal:{x:axis==='x'?1:0,z:axis==='z'?1:0}};
   }
   if(occupied&&!(occupied===b.id+1&&key===b.roadEntryCell)){
    const cx=Math.round(x),cz=Math.round(z),dx=b.x-cx,dz=b.z-cz;
    return {normal:Math.abs(dx)>Math.abs(dz)?{x:1,z:0}:{x:0,z:1}};
   }
  }
  // Sweep against live cycle bodies as well as walls and stored trails.
  const dx=to.x-b.x,dz=to.z-b.z,length2=dx*dx+dz*dz;
  for(const other of r.cycles){
   if(other===b||!other.alive)continue;
   const f=cycleFraction(r,other),ox=other.previousX+(other.x-other.previousX)*f,oz=other.previousZ+(other.z-other.previousZ)*f;
   const t=length2?Math.max(0,Math.min(1,((ox-b.x)*dx+(oz-b.z)*dz)/length2)):0;
   if(Math.hypot(b.x+t*dx-ox,b.z+t*dz-oz)*C.cellMeters<ARENA_WALL.cycleRadiusMeters*2)return {normal:{x:b.x-ox,z:b.z-oz}};
  }
  return true;
 };
 let remaining=dt;
 while(remaining>1e-9){const step=Math.min(remaining,C.speedStepSeconds);remaining-=step;
  for(const b of r.cycles.filter(b=>b.alive&&b.escaped&&(!playerOnly||b.id===r.playerId))){
   let control=input;
   if(b.id!==r.playerId){
    const probe={x:b.x-Math.sin(b.yaw)*Math.max(20,b.roadSpeed)/C.cellMeters,z:b.z-Math.cos(b.yaw)*Math.max(20,b.roadSpeed)/C.cellMeters};
    const safe=clear(b,probe)===true;control={throttle:safe&&b.roadSpeed<C.speedMetersPerSecond,brake:!safe,turbo:safe&&hasTurboReason(r,b)&&(b.boosting||b.turboCharge>=C.aiReserveStartCharge),steer:safe?0:1};
   }
   if(!advanceRoadCycle(b,step,control,clear,r.roadConfig))r.crashes.push({id:b.id,x:b.x,z:b.z,team:b.team,dir:b.dir,time:r.time});
   if(`${Math.round(b.x)},${Math.round(b.z)}`!==b.roadEntryCell)b.roadEntryCell=null;
   if(b.alive)reenterArena(r,b,clear);
  }
 }
}
