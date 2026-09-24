import {supportingAttack} from './attack-coordination.js';
import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
import {aircraftSweepClear} from './maneuver-geometry.js';
import {retireTarget} from './target-memory.js';
import {advanceFlight,advanceYaw,advanceLift,FLIGHT,flightFor} from './flight.js';
import {clamp,RECOGNIZER_SCALE} from '../game/config.js';

// Meters and seconds; model-local distances track the rendered scale.
export const CRUSH=Object.freeze({foldSeconds:1.3,dropAcceleration:85,recoverSpeed:22,cooldown:7,clearance:20*RECOGNIZER_SCALE,triggerDistance:8*RECOGNIZER_SCALE,soleHeight:22*RECOGNIZER_SCALE,hitRadius:11*RECOGNIZER_SCALE,maxCommitYawRate:.04});
export function stompDuration(altitude){
  return CRUSH.foldSeconds+Math.sqrt(2*Math.max(0,altitude-CRUSH.soleHeight)/CRUSH.dropAcceleration);
}
export function stompTarget(e,now,approachSeconds=0){
 const {freePosition}=worldFor(e);
  if(!e.memory)return null;
  const time=Math.max(0,now-e.memory.seenAt)+stompDuration(e.y)+approachSeconds;
  const dx=(e.memory.vx||0)*time,ds=(e.memory.vs||0)*time;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,ds)/3));
  let x=e.memory.x,s=e.memory.s;
  for(let i=1;i<=steps;i++){
    const nx=e.memory.x+dx*i/steps,ns=e.memory.s+ds*i/steps;
    if(!freePosition(nx,ns,3.5))break;
    x=nx;s=ns;
  }
  return {x,s,time};
}
export function stompApproach(e,now,speed){
  let target=stompTarget(e,now);
  for(let i=0;i<4;i++)target=stompTarget(e,now,Math.min(12,Math.hypot(target.x-e.x,target.s-e.s)/speed));
  return target;
}

export const STOMP_INTERCEPT=Object.freeze({horizonSeconds:12,sampleSeconds:.5,settleSeconds:.6});
// Choose a reachable future crossing, allowing time to get there and brake.
// The chosen point is held by the maneuver; fresh observations still decide
// when to fold/drop, so this never authorizes an attack on stale knowledge.
export function stompIntercept(e,now,speed){
 const immediate=stompTarget(e,now);
 if(!immediate||!e.canSee||Math.hypot(e.memory.vx||0,e.memory.vs||0)<2)return immediate;
 const flight=flightFor(e),cruise=Math.min(speed,flight.acceleration/flight.drag);
 const brakingSeconds=Math.log1p(Math.hypot(e.vx||0,e.vs||0))/(flight.drag+flight.brakeDrag);
 for(let wait=0;wait<=STOMP_INTERCEPT.horizonSeconds;wait+=STOMP_INTERCEPT.sampleSeconds){
  const point=stompTarget(e,now,wait),distance=Math.hypot(point.x-e.x,point.s-e.s);
  const travel=Math.max(distance/cruise,Math.sqrt(2*distance/flight.acceleration))+brakingSeconds+STOMP_INTERCEPT.settleSeconds;
  if(travel<=wait)return {...point,approachSeconds:wait};
 }
 return stompApproach(e,now,cruise);
}

export function advanceCrush(e,now,dt) {
 const {WALL_HEIGHT}=worldFor(e);
  if(!e.attack)return false;
  const a=e.attack;e.vx??=0;e.vs??=0;e.vy??=0;
  advanceYaw(e,dt);
  // No horizontal thrust during the committed strike; residual drift decays.
  advanceFlight(e,dt,0,1);
  if(a.phase==='fold') {
    advanceLift(e,dt,a.altitude);
    e.state='fold';e.fold=clamp((now-a.started)/CRUSH.foldSeconds,0,1);
    if(e.fold===1){a.phase='drop';e.state='drop';}
  } else if(a.phase==='drop') {
    e.state='drop';const before=e.vy;e.vy-=CRUSH.dropAcceleration*dt;a.velocity=-e.vy;
    e.y=Math.max(CRUSH.soleHeight,e.y+(before+e.vy)*.5*dt);
    if(e.y===CRUSH.soleHeight){a.phase='hold';a.started=now;a.impact=true;e.vy=0;}
  } else if(a.phase==='hold') {
    e.state='recover';if(now-a.started>.65)a.phase='rise';
  } else {
    e.state='recover';advanceLift(e,dt,a.altitude,CRUSH.recoverSpeed);
    // An aborted drop still carries downward momentum until lift brakes it
    // or physical ground contact stops it.
    if(e.y<CRUSH.soleHeight){e.y=CRUSH.soleHeight;e.vy=Math.max(0,e.vy);}
    // Keep folded while passing the walls; open after the soles clear the roofs.
    if(e.y>WALL_HEIGHT+CRUSH.soleHeight)e.fold=Math.max(0,e.fold-dt/CRUSH.foldSeconds);
    if(Math.abs(e.y-a.altitude)<.2&&Math.abs(e.vy)<.3&&e.fold===0){e.attack=null;e.nextAttack=now+CRUSH.cooldown;e.goal=null;e.state=e.targetGone?'wander':'investigate';}
  }
  return true;
}
export function crushOpportunity(e,now,oriented=false) {
 const FLIGHT=flightFor(e);
 const {freePosition}=worldFor(e);
  if(supportingAttack(e)||e.stompDisabled||e.targetGone||e.attack||!e.canSee||!e.memory||now-e.memory.seenAt>.25||now<(e.nextAttack||0))return;
  const target=stompTarget(e,now),duration=stompDuration(e.y);
  const drift=(1-Math.exp(-(FLIGHT.drag+FLIGHT.brakeDrag)*duration))/(FLIGHT.drag+FLIGHT.brakeDrag);
  const landing={x:e.x+(e.vx||0)*drift,s:e.s+(e.vs||0)*drift};
  if(Math.hypot(target.x-landing.x,target.s-landing.s)>CRUSH.triggerDistance)return;
  // Conservative whole-craft clearance prevents a drop through a roof or wall.
  if(oriented?!aircraftSweepClear(e,{...e,x:landing.x,s:landing.s,y:CRUSH.soleHeight}):!freePosition(e.x,e.s,CRUSH.clearance+1))return;
  return {target,duration};
}
export function beginCrush(e,now,oriented=false) {
  const opportunity=crushOpportunity(e,now,oriented);
  if(!opportunity)return;
  // Finish braking with normal flight authority before committing.
  if(oriented&&Math.abs(e.yawVelocity||0)>CRUSH.maxCommitYawRate)return;
  if(Math.hypot(e.memory.vx||0,e.memory.vs||0)<2&&Math.hypot(e.vx||0,e.vs||0)>1.2)return;
  const {target,duration}=opportunity;
  e.attack={phase:'fold',started:now,altitude:e.y,velocity:0,impact:false,target:{x:target.x,s:target.s},impactAt:now+duration};e.fold=0;e.state='fold';
}
export function resolveCrush(run,e) {
  if(!e.attack?.impact)return;
  if(e.stompDisabled){e.attack.impact=false;return;}
  e.attack.impact=false;
  run.events.push({type:'hit',x:e.x,y:.2,s:e.s});
  if(!run.inspection&&!run.crushed&&!run.teleport&&Math.hypot(run.x-e.x,run.s-e.s)<CRUSH.hitRadius) {
    const speed=run.speed;run.crushed=true;run.speed=0;run.impact=1;retireTarget(e);
    run.events.push({type:'destroyed',subject:'tank',x:run.x,y:0,s:run.s,yaw:run.yaw,turretYaw:run.turretYaw,vx:-Math.sin(run.yaw)*speed,vs:Math.cos(run.yaw)*speed,hit:{x:run.x,y:2,z:-run.s}});
  }
}
