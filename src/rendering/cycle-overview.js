import {Vector3,MathUtils} from 'three';
import {ARENA_WALL} from '../game/arena-breaches.js';
import {config} from '../game/config.js';
import {cyclePlayerPose} from '../simulation/light-cycles.js';
import {ARENA_CAMERA_WALL_HEIGHT} from './arena-camera-collision.js';

export const CYCLE_OVERVIEW=Object.freeze({durationSeconds:3,wallClearanceMeters:6,rimInsetMeters:1,liftFraction:.45,trackingResponsePerSecond:5,lookHeightMeters:1});
// First rise clear of the wall, then pull out to a fixed perch on its rim.
export function updateCycleOverview(rig,race,dt){
 const camera=rig.camera,center=new Vector3(race.site.x,0,-race.site.s);
 if(!rig.cycleOverview){
  const start=camera.position.clone(),offset=start.clone().sub(center),target=center.clone();
  const axis=Math.abs(offset.x)>Math.abs(offset.z)?'x':'z';
  target[axis]+=Math.sign(offset[axis]||1)*(ARENA_WALL.innerMeters+CYCLE_OVERVIEW.rimInsetMeters);
  target.y=ARENA_CAMERA_WALL_HEIGHT+CYCLE_OVERVIEW.wallClearanceMeters;
  rig.cycleOverview={start,target,look:rig.look.clone(),trackedLook:rig.look.clone(),elapsed:0,trackedId:null};
 }
 const shot=rig.cycleOverview;
 let tracked=race.cycles.find(b=>b.alive&&b.id===shot.trackedId);
 if(!tracked){
  tracked=race.cycles.find(b=>b.alive&&!b.escaped)??race.cycles.find(b=>b.alive);
  shot.trackedId=tracked?.id??null;
 }
 const aim=center.clone();
 if(tracked){
  const pose=cyclePlayerPose({...race,playerId:tracked.id});
  aim.set(pose.x,CYCLE_OVERVIEW.lookHeightMeters,-pose.s);
 }
 shot.trackedLook.lerp(aim,1-Math.exp(-dt*CYCLE_OVERVIEW.trackingResponsePerSecond));
 shot.elapsed=Math.min(CYCLE_OVERVIEW.durationSeconds,shot.elapsed+dt);
 const t=shot.elapsed/CYCLE_OVERVIEW.durationSeconds;
 const move=MathUtils.smootherstep(t,CYCLE_OVERVIEW.liftFraction,1),lift=MathUtils.smootherstep(t,0,CYCLE_OVERVIEW.liftFraction);
 camera.position.copy(shot.start).lerp(shot.target,move);
 camera.position.y=MathUtils.lerp(shot.start.y,shot.target.y,lift);
 rig.look.copy(shot.look).lerp(shot.trackedLook,MathUtils.smootherstep(t,0,1));
 camera.lookAt(rig.look);camera.fov=config.fov;camera.far=12000;camera.updateProjectionMatrix();
 rig.cycleAnchor=null;rig.freshCamera=false;
 return {tankVisible:false};
}
