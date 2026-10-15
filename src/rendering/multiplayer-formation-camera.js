import {Vector3,Quaternion,MathUtils} from 'three';
import {MP} from '../../shared/multiplayer/config.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
import {CYCLE_FORMATION_CAMERA as F} from './cycle-opening.js';
import {ARENA_CAMERA_WALL_HEIGHT} from './arena-camera-collision.js';

const UP=new Vector3(0,1,0);
// Match the solo gold shot in each team's local coordinates. Retain framing
// if an authored formation uses wider lane spacing.
export function multiplayerFormationShot(race,seat,aspect){
 const bike=race.cycles.find(b=>b.id===seat)??race.cycles[0];
 const team=race.cycles.filter(b=>b.team===bike.team);
 const center=team.reduce((p,b)=>p.add(new Vector3(b.x*C.cellMeters,0,b.z*C.cellMeters)),new Vector3()).multiplyScalar(1/team.length);
 const span=Math.max(...team.map(b=>Math.hypot(b.x*C.cellMeters-center.x,b.z*C.cellMeters-center.z)))*2;
 const scale=Math.max(1,span/(2*C.cellMeters));
 const yaw=(2-bike.dir)*Math.PI/2;
 const position=new Vector3(F.rightMeters*scale,F.heightMeters*scale,F.forwardMeters*scale).applyAxisAngle(UP,yaw).add(center);
 const look=new Vector3(F.lookRightMeters*scale,F.lookHeightMeters*scale,0).applyAxisAngle(UP,yaw).add(center);
 position.add(new Vector3(race.site.x,0,-race.site.s));look.add(new Vector3(race.site.x,0,-race.site.s));
 const fov=MathUtils.radToDeg(2*Math.atan(Math.tan(MathUtils.degToRad(F.fovDegrees/2))*Math.max(1,F.framingAspect/aspect)));
 return {position,look,fov};
}
export class MultiplayerFormationCamera{
 reset(){this.shot=null;}
 update(rig,run,race,dt,mode){
  if(!run.multiplayer||race.phase!=='countdown'){
   if(this.shot){this.reset();rig.finishCycleOpening();rig.followZoom=1;rig.aerial=false;rig.aerialBlend=0;rig.cycleFollowedId=undefined;rig.cycleSwitch=null;rig.cycleAnchor=null;rig.cycleDeathHold=null;rig.cycleDeathsHeld.clear();rig.cycleOverview=null;rig.spectatorOrbit=null;rig.cycleCockpitMix=0;rig.cycleSpeedDistanceScale=1;}
   return false;
  }
  const seat=run.multiplayer.seat,key=`${race.round}:${seat}`;
  if(this.shot?.key!==key){
   if(rig.freshCamera){rig.camera.position.set(race.site.x,120,-race.site.s+200);rig.camera.lookAt(race.site.x,0,-race.site.s);}
   this.shot={key,round:race.round,seat,elapsed:0,ready:false,position:rig.camera.position.clone(),rotation:rig.camera.quaternion.clone(),fov:rig.camera.fov};
   rig.cycleFirstPerson=false;rig.cycleFirstPersonMix=0;rig.cycleVisibility=1;
  }
  const shot=this.shot,target=multiplayerFormationShot(race,seat,rig.camera.aspect);
  if(mode==='running')shot.elapsed+=dt;
  const t=rig.reducedMotion?1:Math.min(1,shot.elapsed/MP.cameraTravelSeconds),mix=MathUtils.smootherstep(t,0,1);
  rig.camera.position.lerpVectors(shot.position,target.position,mix);
  // Clear intervening walls while crossing the arena; zero offset and velocity
  // at either endpoint keep the formation shot and the departure continuous.
  const arch=Math.max(0,ARENA_CAMERA_WALL_HEIGHT+12-Math.min(shot.position.y,target.position.y));
  rig.camera.position.y+=Math.sin(Math.PI*mix)**2*arch;
  rig.camera.lookAt(target.look);const rotation=new Quaternion().copy(rig.camera.quaternion);
  rig.camera.quaternion.slerpQuaternions(shot.rotation,rotation,mix);
  rig.camera.fov=MathUtils.lerp(shot.fov,target.fov,mix);rig.camera.updateProjectionMatrix();
  rig.look.copy(target.look);rig.followPosition.copy(rig.camera.position);rig.freshCamera=false;
  shot.ready=t===1;return true;
 }
}
