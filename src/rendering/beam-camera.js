import {angleDelta} from '../game/config.js';
import {DATA_BEAM} from '../simulation/data-beams.js';
export const BEAM_CAMERA=Object.freeze({speedMultiplier:.5});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Presentation only. Use simulation time so pause cannot advance the shot.
export class BeamCamera{
 reset(){this.shot=null;this.seen=null;}
 cancel(){this.shot=null;}
 update(run,{yaw,blend=0,transitionSeconds=1.2,turretSpeed=1.2,reducedMotion=false}={}){
  const beam=run.dataBeams?.find(b=>b.transferStartedAt!==null&&b.collectedAt===null);
  if(!beam||!run.transferActive||run.crushed){this.shot=null;return null;}
  const key=beam.id+':'+beam.transferStartedAt;
  if(key!==this.seen){
   this.seen=key;
   this.shot=reducedMotion?null:{key,yaw,blend,rate:turretSpeed*BEAM_CAMERA.speedMultiplier,duration:transitionSeconds/BEAM_CAMERA.speedMultiplier};
  }
  if(reducedMotion||!this.shot)return null;
  const age=Math.max(0,run.time-beam.transferStartedAt),openAt=DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds,shot=this.shot;
  if(age>=openAt){this.shot=null;return {active:false,phase:'complete',blend:0,yaw};}
  const returnAt=Math.max(shot.duration,openAt-shot.duration),returnProgress=Math.max(0,(age-returnAt)/shot.duration);
  const orbitYaw=shot.yaw-shot.rate*Math.min(age,returnAt);
  return {active:true,phase:age<shot.duration?'rise':age<returnAt?'orbit':'return',
   blend:age<shot.duration?shot.blend+(1-shot.blend)*Math.min(1,age/shot.duration):1-Math.min(1,returnProgress),
   yaw:orbitYaw+angleDelta(orbitYaw,yaw)*smooth(returnProgress)};
 }
}
