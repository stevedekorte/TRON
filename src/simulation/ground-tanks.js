import {enemyPlanningBudget} from './planning-budget.js';
import {groundRoute,GroundRoutePlanner} from './ground-routing.js';
export {groundRoute} from './ground-routing.js';
const groundPlanners=new WeakMap();
import {radioRangeFor} from '../game/communication.js';
import { returningToCarrier, groundEscortGoal, ESCORT_NAVIGATION } from './carrier-escort.js';
import {configFor} from '../game/config.js';
import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
import {hearingGoal} from './hearing.js';
import {tacticalEnabled,chooseManeuver} from './tactical.js';
import {patrolChoices} from './patrol-decisions.js';
import {enemyShot} from './enemy-fire.js';
import {trackMobility} from './part-damage.js';
import {stabilizeTurret} from './turret.js';
import {raiseAlert} from './alertness.js';
import {CARRIER,carrierFor} from '../game/carrier.js';
import {clamp,angleDelta,config} from '../game/config.js';
const {MAZE_INSTANCES}=DEFAULT_WORLD;
import {SENSORS,predict} from './recognizers.js';
import {formationTarget} from './formation.js';
import {intercept} from './intercept.js';
export const ESCORT={count:2,turnRate:.8,turretRate:1.3,fireRange:340,spacing:38,damageAlertSeconds:5,damageProbeDistance:80};
export const GROUND_PATROL={count:3,stuckSeconds:5};
export const GROUND_NAVIGATION=Object.freeze({cellMeters:8,maxIterations:12000,detourMazeWidths:3,exitMarginMeters:32,partialProgressMeters:12,goalShiftMeters:12});
const patrolExitCache=new WeakMap();
function patrolHasExit(p,world,config){
 // The authored maze is generated as one connected corridor graph; only the
 // traced blueprint contains free-floor pockets outside that graph.
 if(world.MAZE_KIND!=='blueprint')return true;
 let cache=patrolExitCache.get(world);
 if(!cache||cache.radius!==config.tankRadius){cache={radius:config.tankRadius,points:new Map()};patrolExitCache.set(world,cache);}
 if(!cache.points.has(p)){
  const b=world.MAZE_INSTANCES[p.mazeId].bounds,margin=GROUND_NAVIGATION.exitMarginMeters;
  const goal={x:b.minX-margin,s:b.minS-margin};
  cache.points.set(p,groundRoute(p,goal,{world,vehicleConfig:config,longRange:true,cellMeters:GROUND_NAVIGATION.cellMeters,maxIterations:GROUND_NAVIGATION.maxIterations,detourMeters:world.MAZE_LENGTH*GROUND_NAVIGATION.detourMazeWidths}).length>0);
 }
 return cache.points.get(p);
}
export const GROUND_TANK_COUNT=ESCORT.count+GROUND_PATROL.count*MAZE_INSTANCES.length;
export const groundTankCount=(world=DEFAULT_WORLD)=>ESCORT.count+GROUND_PATROL.count*world.MAZE_INSTANCES.length;
const patrolCache=new WeakMap();
function groundPatrolCells(world,vehicleConfig=configFor(null)){
 const cached=patrolCache.get(world);if(cached?.radius===vehicleConfig.tankRadius)return cached.cells;
 const config=vehicleConfig;
 const {OPEN_CELLS,freePosition,wallIntersection}=world;
 const cells=OPEN_CELLS.filter(p=>freePosition(p.x,p.s,config.tankRadius+1)&&wallIntersection({...p,y:2},{...p,y:2},config.tankRadius+.5)===null);
 patrolCache.set(world,{radius:config.tankRadius,cells});return cells;
}
export function escortSlot(index,time,world=DEFAULT_WORLD){const CARRIER=carrierFor(world);return {x:CARRIER.startX+CARRIER.speed*time+(index%2?100:-100),s:CARRIER.s+(index-(ESCORT.count-1)/2)*ESCORT.spacing};}
export function createGroundTanks(random=Math.random,world=DEFAULT_WORLD,config=configFor(null)){
 const {MAZE_INSTANCES}=world,patrolCells=groundPatrolCells(world,config),GROUND_TANK_COUNT=groundTankCount(world),CARRIER=carrierFor(world);
 const starts=[];
 for(let i=0;i<GROUND_PATROL.count*MAZE_INSTANCES.length;i++){
  const candidates=patrolCells.filter(p=>p.mazeId===Math.floor(i/GROUND_PATROL.count)&&starts.every(q=>Math.hypot(p.x-q.x,p.s-q.s)>30));
  // Blueprint outlines include enclosed pockets. Free floor alone does not
  // make a valid patrol spawn: the tank must be able to leave its corridor.
  let p;
  while(candidates.length){
   const [candidate]=candidates.splice(Math.floor(random()*candidates.length),1);
   if(patrolHasExit(candidate,world,config)){p=candidate;break;}
  }
  if(!p)throw new Error(`No connected ground patrol spawn in maze ${Math.floor(i/GROUND_PATROL.count)}`);
  starts.push(p);
 }
 return Array.from({length:GROUND_TANK_COUNT},(_,index)=>{
  const patrol=index>=ESCORT.count,position=patrol?starts[index-ESCORT.count]:escortSlot(index,0,world),speed=patrol?0:Math.min(CARRIER.speed,config.maxSpeed);
  return attachWorld({...position,index,id:100+index,kind:'ground',role:patrol?'patrol':'escort',patrolSeed:Math.floor(random()*4294967296),weaponSeed:Math.floor(random()*4294967296),patrolGoal:null,alertUntil:0,y:3.8,yaw:patrol?random()*Math.PI*2:-Math.PI/2,turretYaw:0,speed,vx:speed,vs:0,vy:0,state:patrol?'patrol':'escort',health:3,hit:0,recoil:0,cooldown:index*.2,memory:null,canSee:false,targetGone:false,nextSense:index*.025,nextRadio:0,lastBroadcast:-Infinity,neutralizationSent:false,goal:null,nextRoute:0,path:[]},world);
 });
}
function patrolGoal(e,now,others){
 const patrolCells=groundPatrolCells(worldFor(e),configFor(e));
 if(e.patrolGoal&&Math.hypot(e.x-e.patrolGoal.x,e.s-e.patrolGoal.s)>6)return e.patrolGoal;
 const cells=patrolCells.filter(p=>p.mazeId===e.mazeId);
 const random=()=>{e.patrolSeed=(Math.imul(e.patrolSeed,1664525)+1013904223)>>>0;return e.patrolSeed/4294967296;};
 // Patrol one visible corridor segment at a time; choose again at its end.
 // This keeps exploration responsive instead of repeatedly solving long routes.
 const navigable=p=>{
  if(Math.hypot(p.x-e.x,p.s-e.s)>=180||!clear(e,p))return false;
  const dx=p.x-e.x,ds=p.s-e.s,length2=dx*dx+ds*ds;
  return !others.some(o=>{
   if(o===e||!length2)return false;
   const t=((o.x-e.x)*dx+(o.s-e.s)*ds)/length2;
   return t>0&&t<1&&Math.hypot(e.x+t*dx-o.x,e.s+t*ds-o.s)<12;
  });
 };
 let reachable=cells.filter(navigable);
 if(!reachable.some(p=>Math.hypot(p.x-e.x,p.s-e.s)>20)){
  reachable=[];
  for(const radius of [12,24,48])for(let i=0;i<24;i++){const angle=i*Math.PI/12,p={x:e.x+Math.cos(angle)*radius,s:e.s+Math.sin(angle)*radius};if(navigable(p))reachable.push(p);}
 }
 for(const p of patrolChoices(e,reachable,random,now,180)){
  if(Math.hypot(p.x-e.x,p.s-e.s)<8)continue;
  e.patrolGoal={x:p.x,s:p.s};e.path=[e.patrolGoal];e.nextRoute=now+2;return e.patrolGoal;
 }
 return {x:e.x,s:e.s};
}
const clear=(a,b,world=worldFor(a))=>world.wallIntersection({...a,y:2},{...b,y:2},configFor(a).tankRadius+.5)===null;
// Impact direction is a local clue, not knowledge of the hidden shooter's position.
export function reactToGroundHit(e,projectile,now){
 if(e.targetGone)return;
 raiseAlert(e,now);e.nextSense=0;
 if(Math.hypot(projectile.vx,projectile.vs)<1e-6)return;
 e.threatYaw=-Math.atan2(-projectile.vx,-projectile.vs);
 e.threatUntil=now+ESCORT.damageAlertSeconds;e.threatGoal={x:e.x,s:e.s};
 for(let d=10;d<=ESCORT.damageProbeDistance;d+=10){
  const p={x:e.x-Math.sin(e.threatYaw)*d,s:e.s+Math.cos(e.threatYaw)*d};
  if(!clear(e,p))break;e.threatGoal=p;
 }
 e.nextRoute=0;
}
export function updateGroundTanks(run,dt,moveTank,cannonPose){
 const config=configFor(run);
 const {freePosition}=worldFor(run);
 const active=run.enemyTanks.filter(e=>!e.teleport&&e.state!=='destroyed');
 let planner=groundPlanners.get(run);if(!planner){planner=new GroundRoutePlanner();groundPlanners.set(run,planner);}
 planner.update(active);
 for(const e of active){
  if(e.turretHeading==null)e.turretHeading=e.yaw+e.turretYaw;
  e.cooldown=Math.max(0,e.cooldown-dt);e.recoil=Math.max(0,e.recoil-dt*4);e.hit=Math.max(0,e.hit-dt*4);
  if(e.memory&&run.time-e.memory.seenAt>SENSORS.memorySeconds){e.memory=null;e.canSee=false;e.goal=null;}
  let goal=e.role==='patrol'&&!e.memory?patrolGoal(e,run.time,active):escortSlot(e.index,run.time+1,worldFor(run));
  if(e.memory){
   e.state=e.canSee?'pursue':'investigate';goal=predict(e.memory,run.time+1,worldFor(e));
   if(!e.canSee&&Math.hypot(e.x-goal.x,e.s-goal.s)<25){e.state='search';const phase=Math.floor((run.time-e.memory.seenAt)/5)+e.index;goal={x:goal.x+Math.cos(phase*2.4)*60,s:goal.s+Math.sin(phase*2.4)*60};}
   const formation=formationTarget(e,active,goal,radioRangeFor(e),{neighborRange:180,laneSpacing:ESCORT.spacing,trailingDistance:18});
   if(formation&&freePosition(formation.x,formation.s,config.tankRadius+1)&&clear(e,formation))goal=formation;
   e.leader=formation?.leader??e.id;
  }else{e.state=e.role==='patrol'?'patrol':'escort';e.leader=null;}
  const heard=!e.memory&&hearingGoal(e,run.time);if(heard){goal=heard;e.state='investigate';}
  const reacting=!e.canSee&&run.time<(e.threatUntil||0);
  if(reacting){goal=e.threatGoal;e.state='investigate';}
  const escorting=returningToCarrier(e,run.time);
  if(escorting){e.tactical=null;goal=groundEscortGoal(e,goal);}
  const tactical=tacticalEnabled(run)&&!escorting?chooseManeuver(e,run.time,[...run.recognizers,...active],enemyPlanningBudget(run)):null;
  if(tactical)goal=tactical.goal;
  const withdrawing=tactical&&['retreat','regroup'].includes(tactical.kind);
  e.goal=goal;
  const ready=planner.take(e);
  if(ready&&Math.hypot(goal.x-ready.goal.x,goal.s-ready.goal.s)<GROUND_NAVIGATION.goalShiftMeters){
   const route=ready.path;
   while(route.length>1&&clear(e,route[1]))route.shift();
   if(route.length&&clear(e,route[0])){e.path=route;e.routeGoal=ready.goal;}
   else if(!e.path.length||!clear(e,e.path[0]))e.path=[];
   if(!e.path.length&&e.role==='patrol'&&!e.memory)e.patrolGoal=null;
  }
  if(run.time>=e.nextRoute){
   const continuing=e.path.length&&e.routeGoal&&Math.hypot(goal.x-e.routeGoal.x,goal.s-e.routeGoal.s)<GROUND_NAVIGATION.goalShiftMeters&&clear(e,e.path[0]);
   if(clear(e,goal)){planner.cancel(e);e.path=[goal];e.routeGoal={x:goal.x,s:goal.s};}
   else if(!continuing){
    const shared={world:worldFor(e),vehicleConfig:configFor(e)};
    const options=escorting?{...shared,longRange:true,maxIterations:12000,detourMeters:worldFor(e).MAZE_LENGTH*2}:shared;
    const fallback=e.memory?{...shared,longRange:true,cellMeters:GROUND_NAVIGATION.cellMeters,maxIterations:GROUND_NAVIGATION.maxIterations,detourMeters:worldFor(e).MAZE_LENGTH*GROUND_NAVIGATION.detourMazeWidths,allowPartial:true}:null;
    planner.request(e,goal,options,fallback);
   }
   e.nextRoute=run.time+2;
  }
  while(e.path.length&&Math.hypot(e.x-e.path[0].x,e.s-e.path[0].s)<6&&(!e.path[1]||clear(e,e.path[1])))e.path.shift();
  const mobility=trackMobility(e);
  const destination=clear(e,goal)?goal:e.path[0];
  let targetSpeed=0;
  if(destination){
   const dx=destination.x-e.x,ds=destination.s-e.s,desired=reacting?e.threatYaw:-Math.atan2(dx,ds);
   e.yaw+=clamp(angleDelta(e.yaw,desired),-ESCORT.turnRate*mobility.turn*dt,ESCORT.turnRate*mobility.turn*dt);
   const maxSpeed=config.maxSpeed*(escorting?ESCORT_NAVIGATION.catchupSpeedMultiplier:1);
   targetSpeed=Math.min(maxSpeed,Math.hypot(dx,ds)*.8)*Math.max(0,Math.cos(angleDelta(e.yaw,desired)))**4;
   if(!clear(e,goal)&&Math.abs(angleDelta(e.yaw,desired))>.2)targetSpeed=0;
   if(!withdrawing&&e.canSee&&Math.hypot(e.x-e.memory.x,e.s-e.memory.s)<100)targetSpeed=0;
   if(active.some(o=>o!==e&&Math.hypot(o.x-e.x,o.s-e.s)<12&&(-Math.sin(e.yaw)*(o.x-e.x)+Math.cos(e.yaw)*(o.s-e.s))>0))targetSpeed=0;
  }
  targetSpeed*=mobility.speed;
  e.speed+=clamp(targetSpeed-e.speed,-18*dt,8*dt);
  const x=e.x,s=e.s,moveX=-Math.sin(e.yaw)*e.speed*dt,moveS=Math.cos(e.yaw)*e.speed*dt;
  // Steering must obey the same swept margin as pathfinding, including while turning.
  if(clear(e,{x:x+moveX,s:s+moveS}))moveTank(e,moveX,moveS);
  else {e.speed=0;e.nextRoute=Math.min(e.nextRoute,run.time+.25);}
  if(active.some(o=>o!==e&&Math.hypot(o.x-e.x,o.s-e.s)<config.tankRadius*2)||!run.crushed&&!run.teleport&&Math.hypot(run.x-e.x,run.s-e.s)<config.tankRadius*2){e.x=x;e.s=s;e.speed=0;}
  e.vx=(e.x-x)/dt;e.vs=(e.s-s)/dt;
  if(Math.hypot(e.vx,e.vs)<e.speed*.1)e.speed=0;
  if(e.role==='patrol'&&!e.memory){
   e.stalledSeconds=Math.hypot(e.vx,e.vs)<.5?(e.stalledSeconds||0)+dt:0;
   if(e.stalledSeconds>GROUND_PATROL.stuckSeconds){e.patrolGoal=null;e.path=[];e.nextRoute=0;e.stalledSeconds=0;}
  }
  let aim=null;
  if(e.memory){const target=predict(e.memory,run.time,worldFor(e));aim=intercept(cannonPose(e),{...target,y:2.3},{x:e.memory.vx,s:e.memory.vs,y:0});}
  const muzzle=cannonPose(e);
  const desired=reacting?e.threatYaw:aim?-Math.atan2(aim.x-muzzle.x,aim.s-muzzle.s):e.turretHeading;
  e.turretHeading=desired;stabilizeTurret(e,desired,ESCORT.turretRate,dt);
  const pose=cannonPose(e);
  if(withdrawing||!aim||!e.canSee||run.time-e.memory.seenAt>.3||e.cooldown>0||Math.hypot(aim.x-e.x,aim.s-e.s)>ESCORT.fireRange)continue;
  const bearing=-Math.atan2(aim.x-pose.x,aim.s-pose.s);
  if(Math.abs(angleDelta(pose.yaw,bearing))>.035||!clearShot(e,pose,aim,active))continue;
  const shot=enemyShot(e,pose,aim);
  if(!clearShot(e,pose,shot.target,active)){e.cooldown=.25;continue;}
  run.projectiles.push({...pose,vx:shot.vx,vs:shot.vs,vy:shot.vy,life:2.5,faction:'enemy',owner:e.id});
  e.cooldown=shot.cooldown;e.recoil=1;run.events.push({type:'enemyShot',emitterId:e.id,x:pose.x,y:pose.y,s:pose.s});
 }
}
function clearShot(e,pose,aim,others){
 const {wallIntersection}=worldFor(e);
 if(wallIntersection({x:e.x,s:e.s,y:pose.y},pose)!==null||wallIntersection(pose,aim)!==null)return false;
 const dx=aim.x-pose.x,ds=aim.s-pose.s,length=dx*dx+ds*ds;
 return !others.some(o=>{if(o===e)return false;const t=clamp(((o.x-pose.x)*dx+(o.s-pose.s)*ds)/length,0,1);return Math.hypot(o.x-pose.x-dx*t,o.s-pose.s-ds*t)<5;});
}
