import {Vector3,MathUtils} from 'three';
import {cyclePlayerPose} from '../simulation/light-cycles.js';
import {config} from '../game/config.js';
import {ARENA_WALL} from '../game/arena-breaches.js';
import {CAMERA_CLEARANCE,constrainCamera} from './camera-collision.js';
import {cycleCameraWorld,cycleCameraAnchor} from './arena-camera-collision.js';
export const CYCLE_RESULT_CAMERA=Object.freeze({transitionSeconds:2.5,orbitRadiansPerSecond:.16,distanceMeters:10,heightMeters:4,lookHeightMeters:1});
export function cycleResultTarget(run){
 const r=run.cycleRace,eligible=b=>b?.alive&&b.team===r.winner;
 const player=r.cycles.find(b=>b.id===r.playerId),followed=r.cycles.find(b=>b.id===run.cycleFollowId);
 if(r.winner!=null)return [player,followed,...r.cycles].find(eligible);
 const last=[...(r.crashes??[])].sort((a,b)=>b.time-a.time)[0];
 return r.cycles.find(b=>b.id===last?.id)??player??r.cycles[0];
}
export class CycleResultCamera{
 reset(){this.shot=null;}
 update(rig,run,race,dt,mode){
  if(run.playerVehicle!=='cycle'||race?.phase!=='result'){this.reset();return false;}
  if(!this.shot||this.shot.round!==race.round){
   const bike=cycleResultTarget(run);if(!bike)return false;
   const pose=cyclePlayerPose({...race,playerId:bike.id});
   this.shot={round:race.round,id:bike.id,pose,elapsed:0,position:rig.camera.position.clone(),rotation:rig.camera.quaternion.clone(),fov:rig.camera.fov};
  }
  const shot=this.shot,C=CYCLE_RESULT_CAMERA;
  if(mode==='running')shot.elapsed+=dt;
  const t=Math.min(1,shot.elapsed/C.transitionSeconds),mix=t*t*t*(t*(t*6-15)+10);
  const pose=shot.pose,yaw=pose.yaw+shot.elapsed*C.orbitRadiansPerSecond;
  const desired=new Vector3(pose.x+Math.sin(yaw)*C.distanceMeters,C.heightMeters,-pose.s+Math.cos(yaw)*C.distanceMeters);
  // Keep the orbit on the arena side of its wall, including corner winners.
  const limit=ARENA_WALL.innerMeters-CAMERA_CLEARANCE.radiusMeters-CAMERA_CLEARANCE.contactMarginMeters;
  if(Math.max(Math.abs(pose.x-race.site.x),Math.abs(pose.s-race.site.s))<=ARENA_WALL.innerMeters){
   desired.x=race.site.x+MathUtils.clamp(desired.x-race.site.x,-limit,limit);
   desired.z=-race.site.s+MathUtils.clamp(desired.z+race.site.s,-limit,limit);
  }
  const previous=rig.camera.position.clone(),anchor=cycleCameraAnchor(pose,race,C.heightMeters,CAMERA_CLEARANCE.radiusMeters);
  rig.camera.position.lerpVectors(shot.position,desired,mix);
  constrainCamera(cycleCameraWorld(rig.world,race),anchor,rig.camera.position,previous,CAMERA_CLEARANCE.radiusMeters,false,null,dt);
  rig.look.set(pose.x,C.lookHeightMeters,-pose.s);rig.camera.lookAt(rig.look);
  const rotation=rig.camera.quaternion.clone();rig.camera.quaternion.slerpQuaternions(shot.rotation,rotation,mix);
  rig.camera.fov=MathUtils.lerp(shot.fov,config.fov,mix);rig.camera.updateProjectionMatrix();
  rig.followPosition.copy(rig.camera.position);rig.freshCamera=false;
  return true;
 }
}
