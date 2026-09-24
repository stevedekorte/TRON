import {stompLanding,STOMP_POSITION} from './stomp-position.js';
import {supportingAttack,attackSupportGoal} from './attack-coordination.js';
import {radioRangeFor} from '../game/communication.js';
import {configFor} from '../game/config.js';
import {worldFor} from '../levels/scenario.js';
import {connectedSearchRoutes} from './search-routes.js';
import {hearingReports,hearingTarget,hearingGoal} from './hearing.js';
import {HEARING,hearingFor} from '../game/hearing.js';
import {config,angleDelta} from '../game/config.js';
import {TACTICAL} from '../game/tactical.js';
import {advanceFlightToward,advanceFlight,advanceYaw,advanceLift} from './flight.js';
import {beginCrush,crushOpportunity,advanceCrush,stompTarget,stompIntercept,CRUSH} from './crush.js';
import {aircraftPoseClear,aircraftSweepClear,overheadRoute,corridorRoute,SAFE_ALTITUDE,AIR_HULL} from './maneuver-geometry.js';
export const tacticalEnabled=e=>['local','jev'].includes(configFor(e).aiMode);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.s-b.s);
const active=e=>e.health>0&&!e.teleport&&!e.targetGone&&!['destroyed','materializing'].includes(e.state);
export function knownAllies(e,others){return others.filter(o=>o!==e&&active(o)&&Math.hypot(o.x-e.x,o.s-e.s,(o.y||0)-(e.y||0))<=radioRangeFor(e));}
function targetMemory(e,now){
 const {freePosition,lineOfSight}=worldFor(e);
 if(!e.memory||e.targetGone||now-e.memory.seenAt>38)return null;
 const age=Math.min(5,Math.max(0,now-e.memory.seenAt)+(e.canSee?0:TACTICAL.searchLeadSeconds)),m=e.memory;
 const end={x:m.x+(m.vx||0)*age,s:m.s+(m.vs||0)*age};
 // Walk the recorded trajectory to its first obstruction, never project
 // through a slab just because the endpoint happens to be in free space.
 const steps=Math.max(1,Math.ceil(distance(m,end)/3));let p={x:m.x,s:m.s};
 for(let i=1;i<=steps;i++){const next={x:m.x+(end.x-m.x)*i/steps,s:m.s+(end.s-m.s)*i/steps};if(!freePosition(next.x,next.s,3.5)||!lineOfSight({...p,y:2.8},{...next,y:2.8}))break;p=next;}
 return p;
}
// No live player object enters candidate generation or the API snapshot.
export function maneuverOptions(e,now,others){
 const config=configFor(e),HEARING=hearingFor(e);
 const world=worldFor(e),{OPEN_CELLS,freePosition,lineOfSight}=world,SAFE_ALTITUDE=world.WALL_HEIGHT+AIR_HULL.bottom+8;
 const poseClear=p=>aircraftPoseClear(p,null,TACTICAL.clearance,world);
 const target=targetMemory(e,now),allies=knownAllies(e,others),air=e.kind!=='ground';
 const options=[];
 const add=(kind,goal,score,route=null)=>{
  if(!goal||!Number.isFinite(goal.x+goal.s))return;
  if(air){if(!poseClear(goal))return;route??=overheadRoute(e,goal);if(!route)return;}
  else if(!freePosition(goal.x,goal.s,config.tankRadius+1))return;
  const travel=(route||[goal]).reduce((result,p,i,points)=>result+Math.hypot(p.x-(i?points[i-1].x:e.x),p.s-(i?points[i-1].s:e.s),(p.y||0)-(i?points[i-1].y||0:e.y||0)),0);
  const facts={travelMeters:travel,goalDistanceToLastKnownTarget:target?distance(goal,target):null,occludedFromLastKnownTarget:target?!lineOfSight({...goal,y:goal.y||3},{...target,y:2.8}):null,nearbySupport:allies.filter(a=>distance(a,goal)<150).length};
  options.push({id:`m${options.length}`,kind,goal,route,score,facts});
 };
 const hover={x:e.x,s:e.s,y:Math.max(e.y||0,SAFE_ALTITUDE),yaw:e.yaw};
 if(!target){
  const heard=hearingGoal(e,now);if(heard)add('investigate-sound',{...hover,...heard},HEARING.investigateScore);
  const patrol=OPEN_CELLS.filter(p=>p.mazeId===(e.mazeId??0)&&distance(e,p)>40).sort((a,b)=>distance(e,a)-distance(e,b))[0];
  add('patrol',{...hover,...(patrol||{})},30);add('hold',hover,0);return options;
 }
 const dx=e.x-target.x,ds=e.s-target.s,norm=Math.hypot(dx,ds)||1;
 const wounded=e.health<=TACTICAL.retreatHealth,occupied=supportingAttack(e)||!e.attackAssignment&&allies.some(a=>a.attack||a.tactical?.plan?.kind==='strike'&&distance(a,target)<TACTICAL.attackApproachMeters&&distance(a.tactical.plan.goal,target)<30);
 const retreat={x:e.x+dx/norm*TACTICAL.retreatDistance,s:e.s+ds/norm*TACTICAL.retreatDistance,y:SAFE_ALTITUDE,yaw:e.yaw};
 add('retreat',retreat,wounded?120:5);
 const ally=allies.sort((a,b)=>distance(b,target)-distance(a,target))[0];
 if(ally)add('regroup',{x:ally.x+dx/norm*35,s:ally.s+ds/norm*35,y:SAFE_ALTITUDE,yaw:e.yaw},wounded?110:25);
 if(air){
  if(supportingAttack(e)){
   const p=attackSupportGoal(e,target);add('support',{...p,y:SAFE_ALTITUDE,yaw:-Math.atan2(target.x-p.x,target.s-p.s)},wounded?0:95);return options;
  }
  // Find room for the actual oriented silhouette beside a wall, rather than
  // rejecting every site inside a single large circular clearance radius.
  const predicted=stompIntercept(e,now,config.enemySpeed*TACTICAL.cruiseSpeedMultiplier)||target;
  const landing=e.canSee?stompLanding(e,predicted):null;
  // Close on recorded contact even when another unit owns the final attack.
  // Offset supporting units so they do not all converge on the stomp column.
  const side=(e.id%2?1:-1)*TACTICAL.supportOffsetMeters;
  const pursuit={x:predicted.x+(occupied?-ds/norm*side:0),s:predicted.s+(occupied?dx/norm*side:0),y:Math.max(e.y,SAFE_ALTITUDE),yaw:-Math.atan2(predicted.x-e.x,predicted.s-e.s)};
  // Pursuit should finish at an attackable pose, including the wall-aligned
  // yaw and small lateral offset needed to fit a confined descent column.
  if(landing&&!occupied)Object.assign(pursuit,{x:landing.x,s:landing.s,yaw:landing.yaw});
  if(e.canSee||!e.tactical?.search?.originChecked)add('pursue',pursuit,wounded?-20:distance(e,target)>TACTICAL.attackApproachMeters?88:occupied?78:40);
  if(landing&&e.canSee){
   add('strike',{...landing,y:SAFE_ALTITUDE},wounded?-20:occupied?15:e.y>TACTICAL.lowAltitude+1&&distance(e,target)<=TACTICAL.attackApproachMeters?95:85);
   const low={...landing,y:TACTICAL.lowAltitude};
   // An airborne attacker should descend at the destination, not try to
   // return to its moving route origin to descend before travelling.
   if(distance(e,low)<TACTICAL.routeRadius){const route=e.y>=SAFE_ALTITUDE?overheadRoute(e,low):corridorRoute(e,low);if(route)add('low-approach',low,wounded?-20:e.canSee?90:65,route);}
  }
  if(predicted.approachSeconds!=null)for(const option of options)if(['pursue','strike','low-approach'].includes(option.kind)){
   option.intercept={impactAt:now+predicted.time,observation:{...e.memory}};
   option.facts.interceptImpactAt=option.intercept.impactAt;
   option.facts.approachSeconds=predicted.approachSeconds;
  }
  // Even when a strike is impossible, descend into a reachable broad opening.
  const openings=OPEN_CELLS.filter(p=>distance(p,target)<100&&distance(e,p)<TACTICAL.routeRadius).sort((a,b)=>distance(a,target)-distance(b,target));
  for(const p of openings.slice(0,8)){
   const low={...p,y:TACTICAL.lowAltitude,yaw:-Math.atan2(target.x-p.x,target.s-p.s)};
   if(!poseClear(low))continue;
   const route=corridorRoute(e,low)||overheadRoute(e,low);if(route){add('low-cover',low,wounded?0:55,route);break;}
  }
 }else if(e.canSee||!e.tactical?.search?.originChecked)add('pressure',{...target,y:0,yaw:e.yaw},wounded?-20:75);
 if(!e.canSee){
  // Push to the last-known path, then check plausible nearby branches. These
  // are search hypotheses, not newly invented sightings or attack targets.
  if(!e.tactical?.search?.originChecked&&distance(e,target)>TACTICAL.searchArrivalMeters)add('search-track',{...target,y:air?Math.max(e.y,SAFE_ALTITUDE):0,yaw:-Math.atan2(target.x-e.x,target.s-e.s)},wounded?0:96);
  const search=e.tactical?.search,m=e.memory,speed=Math.hypot(m.vx||0,m.vs||0)||1;
  const visited=search?.visited||[];
  const rank=p=>distance(p,e)*.6+p.cost*.2-((p.x-target.x)*(m.vx||0)+(p.s-target.s)*(m.vs||0))/speed*.25
    +allies.filter(a=>a.tactical?.plan?.kind==='search-branch'&&distance(a.tactical.plan.goal,p)<40).length*100;
  const branches=(search?.routes||connectedSearchRoutes(target,{world:worldFor(e),vehicleConfig:configFor(e)})).filter(p=>distance(p,e)>TACTICAL.searchVisitMeters&&!visited.some(v=>distance(p,v)<TACTICAL.searchCheckedRadiusMeters)).map(p=>({point:p,score:rank(p)})).sort((a,b)=>a.score-b.score).map(entry=>entry.point);
  let offered=0;
  for(const p of branches){
   if(offered>=2)break;
   // Inspect a point far enough along the corridor to reveal a new section.
   if(distance(p,e)<TACTICAL.searchArrivalMeters)continue;
   const goal={x:p.x,s:p.s,y:air?SAFE_ALTITUDE:0,yaw:-Math.atan2(p.x-e.x,p.s-e.s)};
   let route=null;
   if(air&&e.y<=TACTICAL.lowAltitude+.3&&Math.hypot(e.vx,e.vs)<.7&&distance(e,p)<TACTICAL.routeRadius){const low={...goal,y:TACTICAL.lowAltitude};if(poseClear(low)){route=corridorRoute(e,low);if(route)goal.y=low.y;}}
   const before=options.length;add('search-branch',goal,wounded?0:94-offered,route);
   if(options.length>before){options.at(-1).searchPath=p.path;offered++;}
  }
 }
 const exits=OPEN_CELLS.filter(p=>distance(p,target)>35&&distance(p,target)<140).sort((a,b)=>distance(e,a)-distance(e,b));
 const cover=exits.find(p=>!lineOfSight({...p,y:air?TACTICAL.lowAltitude:3},{...target,y:2.8}))||exits[0];
 if(cover)add('ambush',{...cover,y:air?TACTICAL.lowAltitude:0,yaw:-Math.atan2(target.x-cover.x,target.s-cover.s)},wounded?70:!e.canSee?70:45);
 add('hold',hover,wounded?-10:occupied?60:10);
 return options;
}
function observedState(e,now){
 const m=e.memory&&!e.targetGone&&now-e.memory.seenAt<=TACTICAL.jevMemoryMaxAgeSeconds?e.memory:null;
 return {visible:!!e.canSee,known:!!m,x:m?.x,s:m?.s,vx:m?.vx||0,vs:m?.vs||0};
}
function observationChange(e,now){
 const old=e.tactical?.observation;if(!old)return null;
 const next=observedState(e,now);
 if(next.visible!==old.visible)return next.visible?'sight-regained':'sight-lost';
 if(next.known!==old.known)return next.known?'contact-reported':'contact-expired';
 if(next.known&&Math.hypot(next.vx-old.vx,next.vs-old.vs)>=TACTICAL.velocityChangeMetersPerSecond)return 'target-maneuver';
 if(next.known&&distance(next,old)>=TACTICAL.targetShiftMeters){
  const intercept=e.tactical?.plan?.intercept,m=intercept?.observation;
  const age=m?Math.max(0,now-m.seenAt):0;
  // Movement along the observed intercept trajectory is expected progress,
  // not a reason to keep moving the chosen ambush point farther ahead.
  if(!m||now>intercept.impactAt||Math.hypot(next.x-m.x-m.vx*age,next.s-m.s-m.vs*age)>TACTICAL.interceptTrackToleranceMeters)return 'target-moved';
 }
 return null;
}
function updateSearch(e,now){
 const t=e.tactical,target=targetMemory(e,now);
 if(e.canSee||!target){t.search=null;return;}
 if(!t.search||distance(t.search.memory,e.memory)>=TACTICAL.targetShiftMeters){
  t.search={memory:{...e.memory},origin:target,originChecked:false,visited:[],routes:null};
 }
 const search=t.search;
 if(!search.originChecked&&distance(e,search.origin)<=TACTICAL.searchArrivalMeters){
  search.originChecked=true;search.visited.push({...search.origin});
  if(t.plan?.kind==='search-track')t.plan=null;
 }
 if(t.plan?.kind==='search-branch'&&distance(e,t.plan.goal)<TACTICAL.searchVisitMeters&&(e.kind==='ground'||Math.abs(e.y-t.plan.goal.y)<6)){
  search.visited.push({x:t.plan.goal.x,s:t.plan.goal.s});t.plan=null;
 }
}
export function chooseManeuver(e,now,others,budget=null){
 e.tactical??={revision:0,nextPlan:0};const t=e.tactical;
 updateSearch(e,now);
 if(t.plan?.kind==='investigate-sound'&&!hearingTarget(e,now))t.plan=null;
 const reason=observationChange(e,now),urgent=reason&&now-(t.lastEventAt??-Infinity)>=TACTICAL.eventCooldownSeconds;
 const injured=e.health<=TACTICAL.retreatHealth&&t.plan&&!['retreat','regroup'].includes(t.plan.kind);
 if(t.plan&&now<=t.plan.intercept?.impactAt&&!injured&&!urgent)return t.plan;
 if(t.plan&&now<t.nextPlan&&!injured&&!urgent)return t.plan;
 // Let a multi-stage maneuver finish; replan when observations move materially.
 if(t.plan&&now-(t.started||0)<20&&t.index<(t.plan.route?.length||0)&&!injured&&!urgent&&(!e.memory||!t.target||distance(e.memory,t.target)<45))return t.plan;
 if(!t.plan&&t.options?.length===0&&now<t.nextPlan&&!injured&&!urgent)return null;
 if(budget){if(budget.remaining<=0)return injured?null:t.plan;budget.remaining--;}
 if(t.search&&!t.search.routes)t.search.routes=connectedSearchRoutes(t.search.origin,{world:worldFor(e),vehicleConfig:configFor(e)});
 if(urgent)t.lastEventAt=now;
 t.reason=reason||(injured?'injury':'scheduled');t.observation=observedState(e,now);
 if(e.canSee)t.search=null;
 if(e.kind==='ground')e.nextRoute=0;
 t.options=maneuverOptions(e,now,others);t.revision++;t.started=now;t.nextPlan=now+TACTICAL.replanSeconds;t.index=0;t.blocked=false;
 t.target=e.memory?{x:e.memory.x,s:e.memory.s}:null;t.plan=[...t.options].sort((a,b)=>b.score-a.score)[0]||null;t.source='local';
 t.snapshot=tacticalSnapshot(e,now,others);return t.plan;
}
export function tacticalSnapshot(e,now,others){
 const {nearbyWalls}=worldFor(e);
 const t=e.tactical,allies=knownAllies(e,others);
 return {time:now,units:'meters, seconds, radians; x/s horizontal, y up; forward=(-sin(yaw),cos(yaw))',
  self:{id:e.id,kind:e.kind||'recognizer',x:e.x,s:e.s,y:e.y,yaw:e.yaw,vx:e.vx,vs:e.vs,vy:e.vy,yawVelocity:e.yawVelocity,fold:e.fold||0,health:e.health,canSee:!!e.canSee},
  sounds:hearingReports(e,now),
  target:e.memory&&!e.targetGone?{...e.memory,age:now-e.memory.seenAt}:null,
  allies:allies.map(a=>({id:a.id,kind:a.kind||'recognizer',x:a.x,s:a.s,y:a.y,yaw:a.yaw,vx:a.vx,vs:a.vs,health:a.health,state:a.state,intention:a.tactical?.plan?.kind||null,memory:a.memory?{...a.memory,age:now-a.memory.seenAt}:null})),
  map:nearbyWalls(e.x,e.s,TACTICAL.mapRadius).slice(0,48).map(w=>({height:w.height,points:w.points})),
  search:t?.search?{origin:t.search.origin,originChecked:t.search.originChecked,checked:t.search.visited}:null,
  replanReason:t?.reason||null,current:t?.plan?.kind||null,attackAssignment:e.attackAssignment||null,options:(t?.options||[]).map(({id,kind,goal,route,score,facts,searchPath})=>({id,kind,goal,route,facts,searchPath,localScore:score}))};
}
export function applyTacticalChoice(e,choice,revision,requestedAt,now){
 const config=configFor(e);
 const t=e.tactical;if(!active(e)||e.attack||observationChange(e,now)||!t||t.revision!==revision||now-requestedAt>TACTICAL.requestMaxAge||!Number.isFinite(choice.confidence)||choice.confidence<(config.aiConfidence??TACTICAL.confidence))return false;
 const option=t.options.find(o=>o.id===choice.id);if(!option||option.kind==='investigate-sound'&&!hearingTarget(e,now))return false;
 if(e.health<=TACTICAL.retreatHealth&&!['retreat','regroup','ambush'].includes(option.kind))return false;
 if(t.target&&e.memory&&distance(t.target,e.memory)>45)return false;
 t.plan=option;t.index=0;t.source='jev';t.nextPlan=Math.max(t.nextPlan,now+TACTICAL.commitSeconds);return true;
}
export function navigateTactical(e,now,dt,others,budget=null){
 const config=configFor(e);
 const SAFE_ALTITUDE=worldFor(e).WALL_HEIGHT+AIR_HULL.bottom+8;
 const before={x:e.x,s:e.s,y:e.y,yaw:e.yaw};
 if(e.attack){advanceCrush(e,now,dt);}
 else{
  const plan=chooseManeuver(e,now,others,budget),t=e.tactical;
  // Above the roof, turn and climb while travelling. Do not fly back to the
  // route's initial stationary poses after forward momentum carries us away.
  if(plan?.route?.length>=3&&t.index<2&&e.y>=SAFE_ALTITUDE&&plan.route[0].y>=SAFE_ALTITUDE&&plan.route[1].x===plan.route[0].x&&plan.route[1].s===plan.route[0].s&&plan.route[2].y>=SAFE_ALTITUDE)t.index=2;
  e.state=e.canSee?'pursue':e.memory||plan?.kind==='investigate-sound'?'investigate':'wander';
  if(!plan){advanceFlight(e,dt,0,1);advanceYaw(e,dt);advanceLift(e,dt,Math.max(e.y,SAFE_ALTITUDE));}
  else{
   // An already aligned aircraft may pass through redundant climb/turn
   // waypoints without braking to a stop on every moving-target replan.
   while(t.index<(plan.route?.length||0)-1){
    const current=plan.route[t.index],next=plan.route[t.index+1];
    if(distance(e,current)>Math.max(TACTICAL.arrivalDistance,Math.hypot(e.vx,e.vs)*TACTICAL.routeLookAheadSeconds)||Math.abs(current.y-e.y)>.3||Math.abs(angleDelta(e.yaw,current.yaw))>TACTICAL.arrivalAngle||Math.abs(angleDelta(current.yaw,next.yaw))>.08||Math.abs(next.y-current.y)>.3)break;
    t.index++;
   }
   const waypoint=plan.route?.[t.index]||plan.goal,dist=distance(e,waypoint),vertical=Math.abs(waypoint.y-e.y),speed=Math.hypot(e.vx,e.vs);
   const finalApproach=distance(waypoint,plan.goal)<STOMP_POSITION.arrivalMeters;
   const arrival=finalApproach&&['pursue','strike','low-approach'].includes(plan.kind)?STOMP_POSITION.arrivalMeters:TACTICAL.arrivalDistance;
   const offensive=['pursue','strike','low-approach'].includes(plan.kind)&&e.health>TACTICAL.retreatHealth;
   // Brake at an already viable intercept instead of orbiting a precise
   // waypoint or rotating back to a redundant planned heading.
   const settling=offensive&&!!crushOpportunity(e,now,true);
   const moving=!settling&&dist>arrival;
   const clearAttackPose=finalApproach&&['pursue','strike','low-approach'].includes(plan.kind)&&aircraftPoseClear({...e,y:CRUSH.soleHeight},null,TACTICAL.clearance,worldFor(e));
   const heading=settling||!moving&&clearAttackPose?null:offensive&&e.y>=SAFE_ALTITUDE?plan.goal.yaw:waypoint.yaw;
   advanceYaw(e,dt,heading);
   // Carry speed through straight route segments; only the next real corner
   // or final approach is a braking destination.
   let travelDistance=dist,previous=waypoint;
   for(let i=t.index+1;vertical<.3&&i<(plan.route?.length||0);i++){
    const next=plan.route[i];
    if(Math.abs(angleDelta(previous.yaw,next.yaw))>.08||Math.abs(previous.y-next.y)>.3)break;
    travelDistance+=distance(previous,next);previous=next;
   }
   const max=e.y<SAFE_ALTITUDE?TACTICAL.lowSpeed:config.enemySpeed*TACTICAL.cruiseSpeedMultiplier;
   // Translation is independent of facing; arrival still brakes normally.
   const target=moving?Math.min(max,travelDistance*.8):0;
   advanceFlightToward(e,dt,waypoint.x-e.x,waypoint.s-e.s,target);
   // Finish translation and alignment before descending into a confined area.
   advanceLift(e,dt,settling?e.y:moving||Math.abs(angleDelta(e.yaw,waypoint.yaw))>.08?Math.max(e.y,waypoint.y):waypoint.y);
   // A safe attack opportunity belongs to local execution, including when
   // JEV chose pursuit. beginCrush checks fresh sight, leadership, cooldown,
   // braking drift and the entire oriented descent; a waypoint is not a gate.
   if(['pursue','strike','low-approach'].includes(plan.kind)&&e.health>TACTICAL.retreatHealth)beginCrush(e,now,true);
   if(dist<arrival&&vertical<.3&&speed<.7&&Math.abs(e.vy)<.5&&Math.abs(angleDelta(e.yaw,waypoint.yaw))<TACTICAL.arrivalAngle){
    if(t.index<(plan.route?.length||0)-1)t.index++;
    else{
     t.index=plan.route?.length||0;
     if(plan.kind==='search-branch'&&t.search){t.search.visited.push({x:plan.goal.x,s:plan.goal.s});t.plan=null;}
     if(['strike','low-approach'].includes(plan.kind)&&e.health>TACTICAL.retreatHealth)beginCrush(e,now,true);
     if(!e.attack&&now>=t.nextPlan)t.plan=null;
    }
   }
  }
 }
 if(!aircraftSweepClear(before,e)){
  Object.assign(e,before,{vx:0,vs:0,vy:0,yawVelocity:0});
  if(e.attack){e.attack.phase='rise';e.attack.altitude=SAFE_ALTITUDE;e.attack.impact=false;}
  if(e.tactical){e.tactical.plan=null;e.tactical.nextPlan=now+.25;e.tactical.blocked=true;}
 }
}
