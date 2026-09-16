import {GUNNER,config,angleDelta,clamp} from '../game/config.js';
export const MOUSE_AIM=Object.freeze({radiansPerPixel:.0025,edgeFraction:.45,slowdownSeconds:.12});
export function updateMouseAim(run,input,scale){
 if(!run.gunner||run.crushed||input.turret||input.aimPitch||run.turretCentering||run.gunnerLeveling){run.mouseAim=null;return;}
 const heading=run.yaw+run.turretYaw;
 if(input.mouseX||input.mouseY){
  const target=run.mouseAim||{yaw:heading,pitch:run.aimPitch};
  const extent=GUNNER.fovs[run.gunnerZoom]*Math.PI/180*MOUSE_AIM.edgeFraction;
  const yawOffset=angleDelta(heading,target.yaw)-(input.mouseX||0)*MOUSE_AIM.radiansPerPixel*scale;
  target.yaw=heading+clamp(yawOffset,-extent,extent);
  target.pitch=clamp(target.pitch-(input.mouseY||0)*MOUSE_AIM.radiansPerPixel*scale,Math.max(GUNNER.minPitch,run.aimPitch-extent),Math.min(GUNNER.maxPitch,run.aimPitch+extent));
  run.mouseAim=target;
 }
 if(!run.mouseAim)return;
 const yawError=angleDelta(run.mouseAim.yaw,heading),pitchError=run.mouseAim.pitch-run.aimPitch;
 return {yawError,pitchError,yaw:clamp(yawError/(config.turretSpeed*scale*MOUSE_AIM.slowdownSeconds),-1,1),pitch:clamp(pitchError/(GUNNER.pitchRate*scale*MOUSE_AIM.slowdownSeconds),-1,1)};
}
export function limitMouseStep(step,error){return step*error>=0?Math.sign(step)*Math.min(Math.abs(step),Math.abs(error)):step;}
