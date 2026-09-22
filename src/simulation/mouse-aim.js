import {configFor} from '../game/config.js';
import {GUNNER,config,angleDelta,clamp} from '../game/config.js';
export const MOUSE_AIM=Object.freeze({slowdownSeconds:.22,acceleration:6});
export function updateMouseAim(run,input,scale){
 const config=configFor(run);
 if(!run.gunner||run.crushed||input.turret||input.aimPitch||run.turretCentering||run.gunnerLeveling){run.mouseAim=null;return;}
 const heading=run.yaw+run.turretYaw;
 if(input.mouseTarget)run.mouseAim={yaw:input.mouseTarget.yaw,pitch:clamp(input.mouseTarget.pitch,GUNNER.minPitch,GUNNER.maxPitch)};
 if(!run.mouseAim)return;
 const yawError=angleDelta(run.mouseAim.yaw,heading),pitchError=run.mouseAim.pitch-run.aimPitch;
 return {yawError,pitchError,yaw:clamp(yawError/(config.turretSpeed*scale*MOUSE_AIM.slowdownSeconds),-1,1),pitch:clamp(pitchError/(GUNNER.pitchRate*scale*MOUSE_AIM.slowdownSeconds),-1,1)};
}
// Normalized motor command slew; actual angular acceleration scales with zoom/rate.
export function accelerateMouseAim(current,target,dt){
 return current+clamp(target-current,-MOUSE_AIM.acceleration*dt,MOUSE_AIM.acceleration*dt);
}
