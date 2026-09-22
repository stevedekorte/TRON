import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
import {RECOGNIZER_SCALE,angleDelta,clamp} from '../game/config.js';
const {MAZE_LENGTH}=DEFAULT_WORLD;

export const SEARCHLIGHT=Object.freeze({range:MAZE_LENGTH,scanRange:260,halfWidth:14,sweepPeriod:11,sweepAngle:.32,yawRate:.5,pitchRate:.4,acquireYawRate:1.2,acquirePitchRate:.9,trackYawRate:1.8,trackPitchRate:1.2,lockAngle:.025,minimumAcquire:.25,closeRange:120,fadeSeconds:.8});
export function projectorOrigin(e){return {x:e.x-Math.sin(e.yaw)*3*RECOGNIZER_SCALE,y:e.y+7*RECOGNIZER_SCALE,s:e.s+Math.cos(e.yaw)*3*RECOGNIZER_SCALE};}
export function scanAngles(e,time){
 const goal=e.goal||e.memory,base=goal?-Math.atan2(goal.x-e.x,goal.s-e.s):e.yaw;
 return {yaw:e.yaw+clamp(angleDelta(e.yaw,base),-.55,.55)+Math.sin(time*Math.PI*2/SEARCHLIGHT.sweepPeriod+e.id*1.9)*SEARCHLIGHT.sweepAngle,
 pitch:-clamp(Math.atan2(e.y,Math.max(60,goal?Math.hypot(goal.x-e.x,goal.s-e.s):180)),.18,.8)};
}
export function beginSpotlight(e,observation,now){
 const angles=e.spotlight||e.scanBeam||scanAngles(e,now);
 e.spotlight={yaw:angles.yaw,pitch:angles.pitch,phase:'acquire',started:now,target:{...observation}};
}
export function spotlightOnTarget(e,target){
 const {lineOfSight,MAZE_LENGTH}=worldFor(e);
 const beam=e.spotlight;if(!beam)return false;
 const origin=projectorOrigin(e),dx=target.x-origin.x,ds=target.s-origin.s,dy=2.8-origin.y,distance=Math.hypot(dx,ds,dy);
 const yaw=-Math.atan2(dx,ds),pitch=Math.atan2(dy,Math.hypot(dx,ds));
 return distance<=MAZE_LENGTH&&Math.abs(angleDelta(beam.yaw,yaw))*Math.cos(pitch)<SEARCHLIGHT.lockAngle&&Math.abs(beam.pitch-pitch)<SEARCHLIGHT.lockAngle&&lineOfSight(origin,{x:target.x,s:target.s,y:2.8});
}
// Only stored visual observations steer the projector. Hidden Clu state never enters here.
export function updateSpotlight(e,now,dt){
 const beam=e.spotlight;
 if(!beam){
  const desired=scanAngles(e,now);
  if(!e.scanBeam)e.scanBeam={...desired};
  e.scanBeam.yaw+=clamp(angleDelta(e.scanBeam.yaw,desired.yaw),-SEARCHLIGHT.yawRate*dt,SEARCHLIGHT.yawRate*dt);
  e.scanBeam.pitch+=clamp(desired.pitch-e.scanBeam.pitch,-SEARCHLIGHT.pitchRate*dt,SEARCHLIGHT.pitchRate*dt);
  return;
 }
 e.scanBeam={yaw:beam.yaw,pitch:beam.pitch};
 if(e.targetGone||e.state==='destroyed'){e.spotlight=null;return;}
 const close=beam.target&&Math.hypot(beam.target.x-e.x,beam.target.s-e.s)<=SEARCHLIGHT.closeRange;
 if(beam.phase==='track'&&(!beam.target||close)){beam.phase='fade';beam.fadeAt=now;}
 if(beam.phase==='fade'&&now-beam.fadeAt>=SEARCHLIGHT.fadeSeconds){e.spotlight=null;return;}
 const observed=beam.target;if(!observed)return;
 // Compensate for the sensor sampling interval using only the last visible velocity.
 const age=clamp(now-observed.seenAt,0,.25);
 const target={x:observed.x+(observed.vx||0)*age,s:observed.s+(observed.vs||0)*age};
 const origin=projectorOrigin(e),yaw=-Math.atan2(target.x-origin.x,target.s-origin.s),pitch=Math.atan2(2.8-origin.y,Math.hypot(target.x-origin.x,target.s-origin.s));
 // A visible target gets a faster servo than the deliberate search sweep.
 const yawRate=beam.phase==='acquire'?SEARCHLIGHT.acquireYawRate:SEARCHLIGHT.trackYawRate;
 const pitchRate=beam.phase==='acquire'?SEARCHLIGHT.acquirePitchRate:SEARCHLIGHT.trackPitchRate;
 beam.yaw+=clamp(angleDelta(beam.yaw,yaw),-yawRate*dt,yawRate*dt);
 beam.pitch+=clamp(pitch-beam.pitch,-pitchRate*dt,pitchRate*dt);
}
export function spotlightStrength(e,now){
 const beam=e.spotlight;if(!beam)return 0;
 return beam.phase==='fade'?clamp(1-(now-beam.fadeAt)/SEARCHLIGHT.fadeSeconds,0,1):1;
}
