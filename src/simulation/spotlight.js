import {RECOGNIZER_SCALE,angleDelta,clamp} from '../game/config.js';
import {lineOfSight} from '../levels/maze.js';

export const SEARCHLIGHT=Object.freeze({range:260,halfWidth:14,sweepPeriod:7,sweepAngle:.32,yawRate:.85,pitchRate:.65,lockAngle:.025,minimumAcquire:.25,trackSeconds:1.5,fadeSeconds:.8});
export function projectorOrigin(e){return {x:e.x-Math.sin(e.yaw)*3*RECOGNIZER_SCALE,y:e.y+7*RECOGNIZER_SCALE,s:e.s+Math.cos(e.yaw)*3*RECOGNIZER_SCALE};}
export function scanAngles(e,time){
 const goal=e.goal||e.memory,base=goal?-Math.atan2(goal.x-e.x,goal.s-e.s):e.yaw;
 return {yaw:e.yaw+clamp(angleDelta(e.yaw,base),-.55,.55)+Math.sin(time*Math.PI*2/SEARCHLIGHT.sweepPeriod+e.id*1.9)*SEARCHLIGHT.sweepAngle,
 pitch:-clamp(Math.atan2(e.y,Math.max(60,goal?Math.hypot(goal.x-e.x,goal.s-e.s):180)),.18,.8)};
}
export function beginSpotlight(e,observation,now){
 const angles=e.spotlight||scanAngles(e,now);
 e.spotlight={yaw:angles.yaw,pitch:angles.pitch,phase:'acquire',started:now,target:{...observation}};
}
export function spotlightOnTarget(e,target){
 const beam=e.spotlight;if(!beam)return false;
 const origin=projectorOrigin(e),dx=target.x-origin.x,ds=target.s-origin.s,dy=2.8-origin.y,distance=Math.hypot(dx,ds,dy);
 const yaw=-Math.atan2(dx,ds),pitch=Math.atan2(dy,Math.hypot(dx,ds));
 return distance<=SEARCHLIGHT.range&&Math.abs(angleDelta(beam.yaw,yaw))*Math.cos(pitch)<SEARCHLIGHT.lockAngle&&Math.abs(beam.pitch-pitch)<SEARCHLIGHT.lockAngle&&lineOfSight(origin,{x:target.x,s:target.s,y:2.8});
}
// Only stored visual observations steer the projector. Hidden Clu state never enters here.
export function updateSpotlight(e,now,dt){
 const beam=e.spotlight;if(!beam)return;
 if(e.targetGone||e.state==='destroyed'){e.spotlight=null;return;}
 if(beam.phase==='track'&&now-beam.confirmedAt>=SEARCHLIGHT.trackSeconds){beam.phase='fade';beam.fadeAt=now;}
 if(beam.phase==='fade'&&now-beam.fadeAt>=SEARCHLIGHT.fadeSeconds){e.spotlight=null;return;}
 const target=beam.target;if(!target)return;
 const origin=projectorOrigin(e),yaw=-Math.atan2(target.x-origin.x,target.s-origin.s),pitch=Math.atan2(2.8-origin.y,Math.hypot(target.x-origin.x,target.s-origin.s));
 beam.yaw+=clamp(angleDelta(beam.yaw,yaw),-SEARCHLIGHT.yawRate*dt,SEARCHLIGHT.yawRate*dt);
 beam.pitch+=clamp(pitch-beam.pitch,-SEARCHLIGHT.pitchRate*dt,SEARCHLIGHT.pitchRate*dt);
}
export function spotlightStrength(e,now){
 const beam=e.spotlight;if(!beam)return 0;
 return beam.phase==='fade'?clamp(1-(now-beam.fadeAt)/SEARCHLIGHT.fadeSeconds,0,1):1;
}
