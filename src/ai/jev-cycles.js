import {LIGHT_CYCLES as C,CYCLE_JEV as J,CYCLE_DIRECTIONS as DIR} from '../game/light-cycles.js';
import {cycleCellFree} from '../simulation/light-cycles.js';
import {configFor} from '../game/config.js';

// Low-frequency destinations guide local steering; no network wait in the simulation.
export function selectCycleParticipant(run){
 const race=run.cycleRace;
 if(!race||race.phase!=='racing'||race.arenaPaused)return null;
 const bikes=race.cycles.filter(b=>b.alive&&!b.escaped&&b.id!==race.playerId)
  .sort((a,b)=>(a.jevRequestedAt??-Infinity)-(b.jevRequestedAt??-Infinity));
 const bike=bikes.find(b=>race.time-(b.jevRequestedAt??-Infinity)>=J.replanSeconds);
 if(!bike)return null;
 const options=[];
 for(const dir of [bike.dir,(bike.dir+1)%4,(bike.dir+3)%4]){
  const [dx,dz]=DIR[dir];let clear=0;
  while(clear<J.goalCells&&cycleCellFree(race,bike.x+dx*(clear+1),bike.z+dz*(clear+1)))clear++;
  if(clear<J.minGoalCells)continue;
  options.push({id:`m${options.length}`,kind:dir===bike.dir?'continue corridor':'change corridor',
   goal:{x:(bike.x+dx*clear)*C.cellMeters,s:-(bike.z+dz*clear)*C.cellMeters},localScore:clear,clearMeters:clear*C.cellMeters});
 }
 bike.jevRequestedAt=race.time;
 if(!options.length)return null;
 const pose=b=>({id:b.id,team:b.team,x:b.x*C.cellMeters,s:-b.z*C.cellMeters,dir:b.dir,
  speedMetersPerSecond:C.speedMetersPerSecond*(b.speedMultiplier??1),turboCharge:b.turboCharge,brakeCharge:b.brakeCharge});
 const visibleCycles=race.cycles.filter(other=>{
  if(other===bike||!other.alive||other.escaped)return false;
  const dx=other.x-bike.x,dz=other.z-bike.z,distance=Math.hypot(dx,dz);
  if(distance*C.cellMeters>J.rangeMeters)return false;
  const steps=Math.ceil(distance*2);
  for(let i=1;i<steps;i++){
   const x=Math.round(bike.x+dx*i/steps),z=Math.round(bike.z+dz*i/steps);
   if(x===bike.x&&z===bike.z||x===other.x&&z===other.z)continue;
   if(!cycleCellFree(race,x,z))return false;
  }
  return true;
 }).map(pose);
 const round=race.round,at=race.time;
 const plan={revision:at,snapshot:{controller:'cycle',self:pose(bike),visibleCycles,options,
  arena:{halfWidthMeters:C.halfCells*C.cellMeters},units:'meters, seconds; arena-local x/s'}};
 const current=()=>configFor(run).aiMode==='jev'&&run.cycleRace===race&&race.round===round&&
  race.phase==='racing'&&!race.arenaPaused&&race.cycles.includes(bike)&&bike.alive&&!bike.escaped&&bike.id!==race.playerId;
 return {id:`cycle-${bike.id}`,owner:'cycle',plan,current,
  apply(answer,revision){
   const option=options.find(o=>o.id===answer.id);
   if(!current()||revision!==plan.revision||race.time-at>J.responseMaxAgeSeconds||
    !Number.isFinite(answer.confidence)||answer.confidence<configFor(run).aiConfidence||!option)return false;
   const x=option.goal.x/C.cellMeters,z=-option.goal.s/C.cellMeters;
   if(!cycleCellFree(race,x,z))return false;
   bike.jevGoal={x,z,expiresAt:race.time+J.goalSeconds};return true;
  }};
}
