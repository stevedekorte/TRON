import {HEARING} from '../game/hearing.js';
import {angleDelta,config} from '../game/config.js';
import {lineOfSight,freePosition,OPEN_CELLS} from '../levels/maze.js';
const contexts=new WeakMap();
const active=e=>e.health>0&&!e.teleport&&!['destroyed','materializing'].includes(e.state);
const noise=(seed,salt)=>{let n=Math.imul(seed^salt,1597334677);n=Math.imul(n^(n>>>16),2246822519);return ((n^(n>>>13))>>>0)/4294967295*2-1;};
export function hearingReports(e,now){return (e.hearing||[]).filter(h=>now-h.heardAt<=HEARING.memorySeconds).map(h=>({...h,age:now-h.heardAt}));}
export function hearingTarget(e,now){
 if(e.targetGone)return null;
 return hearingReports(e,now).filter(h=>h.affiliation!=='friendly').sort((a,b)=>b.amplitude/(1+b.age)-a.amplitude/(1+a.age))[0]||null;
}
export function hearingGoal(e,now){
 const h=hearingTarget(e,now);if(!h)return null;
 const p=h.estimatedPosition;
 if(e.kind!=='ground'||freePosition(p.x,p.s,config.tankRadius+1))return {...p};
 // A muffled estimate can land inside a slab. Ground vehicles investigate a
 // nearby navigable opening; they never get the true source position instead.
 const cell=OPEN_CELLS.reduce((best,c)=>!best||Math.hypot(c.x-p.x,c.s-p.s)<Math.hypot(best.x-p.x,best.s-p.s)?c:best,null);
 return cell?{x:cell.x,s:cell.s}:null;
}
export function hearSound(e,sound,now,serial=0,visible=lineOfSight){
 if(!active(e)||sound.emitter===e)return null;
 const dy=sound.y-e.y,dx=sound.x-e.x,ds=sound.s-e.s,distance=Math.hypot(dx,ds,dy);
 if(distance>sound.range)return null;
 const clear=visible({x:e.x,s:e.s,y:e.y},{x:sound.x,s:sound.s,y:sound.y});
 // Pressure falls as 1/r. Wall attenuation reduces range and makes the
 // amplitude-derived estimate seem farther away, as a muffled sound should.
 const amplitude=Math.min(1,sound.range/Math.max(1,distance)*(clear?1:HEARING.wallAmplitude)/100);
 if(amplitude<.01)return null;
 const seed=(e.id+1)*8191+serial*131,weakness=1-Math.min(1,amplitude*10);
 const bearing=-Math.atan2(dx,ds)+noise(seed,17)*HEARING.bearingErrorRadians*(.25+weakness);
 const elevation=Math.atan2(dy,Math.hypot(dx,ds))+noise(seed,31)*HEARING.bearingErrorRadians*.3;
 const nominalRange=sound.type==='engine'?HEARING.engineMovingRangeMeters:sound.range;
 const estimatedDistance=nominalRange/(amplitude*100)*(1+noise(seed,53)*HEARING.distanceErrorFraction);
 const horizontal=estimatedDistance*Math.cos(elevation);
 const h={type:sound.type,heardAt:now,bearing,relativeBearing:angleDelta(e.yaw,bearing),elevation,
  amplitude,estimatedDistance,distanceUncertainty:estimatedDistance*(clear?.3:.65),
  affiliation:sound.friendly?'friendly':'unknown',
  estimatedPosition:{x:e.x-Math.sin(bearing)*horizontal,s:e.s+Math.cos(bearing)*horizontal}};
 e.hearing=[...(e.hearing||[]).filter(old=>now-old.heardAt<=HEARING.memorySeconds&&(old.type!==h.type||old.affiliation!==h.affiliation)),h].slice(-HEARING.maxReports);
 if(!sound.friendly&&!e.memory&&!e.targetGone&&now>=(e.nextHearingReplan||0)){
  e.goal=null;e.goalUntil=0;e.nextRoute=0;
  if(e.tactical){e.tactical.plan=null;e.tactical.nextPlan=0;}
  e.nextHearingReplan=now+HEARING.replanSeconds;
 }
 return h;
}
// Sensor boundary: only this stage reads emitting source positions. Controllers
// and Jev receive noisy reports, never the true coordinates or source identity.
export function updateHearing(run){
 let context=contexts.get(run);if(!context){context={seen:new WeakSet(),nextEngine:0,serial:0};contexts.set(run,context);}
 const units=[...run.recognizers,...run.enemyTanks],listeners=units.filter(active);
 for(const e of units)e.hearing=(e.hearing||[]).filter(h=>run.time-h.heardAt<=HEARING.memorySeconds);
 const emit=sound=>{const serial=++context.serial;for(const e of listeners)hearSound(e,sound,run.time,serial);};
 for(const event of run.events){
  if(context.seen.has(event))continue;context.seen.add(event);
  const type=event.type==='shot'||event.type==='enemyShot'?'cannon fire':event.type==='destroyed'||event.type==='dataCollected'?'explosion':event.type==='hit'?'impact':null;
  if(!type||!Number.isFinite(event.x+event.s))continue;
  emit({type,x:event.x,s:event.s,y:event.y??3,range:type==='cannon fire'?HEARING.cannonRangeMeters:type==='explosion'?HEARING.explosionRangeMeters:HEARING.impactRangeMeters,
   friendly:event.type==='enemyShot',emitter:event.type==='enemyShot'?units.find(e=>e.id===event.emitterId):null});
 }
 if(run.time<context.nextEngine)return;context.nextEngine=run.time+HEARING.engineIntervalSeconds;
 if(!run.crushed&&!run.teleport)emit({type:'engine',x:run.x,s:run.s,y:2.8,range:HEARING.engineIdleRangeMeters+(HEARING.engineMovingRangeMeters-HEARING.engineIdleRangeMeters)*Math.min(1,Math.abs(run.speed)/config.maxSpeed)});
 for(const e of listeners)emit({type:e.kind==='ground'?'engine':'aircraft engine',x:e.x,s:e.s,y:e.y,range:e.kind==='ground'?HEARING.engineMovingRangeMeters:HEARING.aircraftRangeMeters,friendly:true,emitter:e});
}
