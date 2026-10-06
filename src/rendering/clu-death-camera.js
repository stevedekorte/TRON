import * as T from 'three';
import {config} from '../game/config.js';
import {CLU_DEATH_CAMERA,livingCluKiller} from '../game/clu-death.js';
import {CAMERA_CLEARANCE,clipCameraSegment,constrainCamera} from './camera-collision.js';

/** Follow the surviving killer without moving CLU's simulation pose. */
export class CluDeathCamera{
 reset(){this.transition=null;this.recovery={active:false};}
 constructor(){this.reset();}
 update(rig,run,dt,mode){
  if(!run.crushed||run.playerVehicle==='cycle'||mode==='ready'){this.reset();return false;}
  const enemy=livingCluKiller(run),camera=rig.camera;
  if(!this.transition){
   if(!enemy)return false;
   this.transition={position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov,elapsed:0};
   rig.opening=null;rig.gunnerTransition=null;rig.gunnerOpacity=0;
  }
  // If the killer dies during the shot, keep the last view rather than jumping back.
  if(!enemy||mode==='paused')return true;
  const shot=this.transition;shot.elapsed+=dt;
  const blend=T.MathUtils.smootherstep(Math.min(1,shot.elapsed/CLU_DEATH_CAMERA.transitionSeconds),0,1);
  const height=enemy.kind==='ground'?0:enemy.y??0,yaw=enemy.yaw+(enemy.kind==='ground'?(enemy.turretYaw??0):0);
  const anchor=new T.Vector3(enemy.x,height+CAMERA_CLEARANCE.anchorHeightMeters,-enemy.s);
  const target=new T.Vector3(enemy.x,height+(enemy.kind==='ground'?2.5:0),-enemy.s);
  const desired=new T.Vector3(enemy.x+Math.sin(yaw)*config.cameraDistance,height+config.cameraHeight,-enemy.s+Math.cos(yaw)*config.cameraDistance);
  clipCameraSegment(rig.world,anchor,desired);
  const previous=camera.position.clone();
  camera.position.lerpVectors(shot.position,desired,blend);
  constrainCamera(rig.world,anchor,camera.position,previous,CAMERA_CLEARANCE.radiusMeters,false,this.recovery,dt,true);
  camera.lookAt(target);
  camera.quaternion.slerpQuaternions(shot.rotation,camera.quaternion.clone(),blend);
  camera.fov=T.MathUtils.lerp(shot.fov,config.fov,blend);camera.far=12000;camera.updateProjectionMatrix();
  rig.followPosition.copy(camera.position);rig.look.copy(target);rig.freshCamera=false;
  return true;
 }
}
