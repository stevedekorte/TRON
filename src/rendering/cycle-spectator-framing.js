import {Vector3,MathUtils} from 'three';
import {cyclePlayerPose} from '../../shared/simulation/light-cycles.js';

export const SPECTATOR_FRAMING=Object.freeze({responsePerSecond:4,maxOrbitRadiansPerSecond:1.8,sideAngleFovFraction:.45,lookHeightMeters:1});
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

// Orbit the existing boom, rather than zooming out. Aim between the two viewing
// directions (not their world midpoint, which loses the near bike at long range).
export function frameSpectatorOpponent(rig,race,bike,pose,dt){
 let opponent=null,distance=Infinity;
 for(const candidate of race.cycles){
  if(!candidate.alive||candidate.id===bike.id||candidate.team===bike.team||candidate.escaped)continue;
  const p=cyclePlayerPose({...race,playerId:candidate.id});
  const d=Math.hypot(p.x-pose.x,p.s-pose.s);
  if(d<distance){distance=d;opponent=p;}
 }
 if(!opponent||distance<1e-6){rig.spectatorOrbit=null;return false;}
 const target=new Vector3(pose.x,SPECTATOR_FRAMING.lookHeightMeters,-pose.s);
 const other=new Vector3(opponent.x,SPECTATOR_FRAMING.lookHeightMeters,-opponent.s);
 const radius=Math.hypot(rig.desired.x-target.x,rig.desired.z-target.z);
 const vertical=MathUtils.degToRad(rig.camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*rig.camera.aspect);
 const sideAngle=Math.min(vertical,horizontal)*SPECTATOR_FRAMING.sideAngleFovFraction;
 const behind=Math.atan2(target.x-other.x,target.z-other.z);
 const current=rig.spectatorOrbit?.id===bike.id?rig.spectatorOrbit.yaw:Math.atan2(rig.camera.position.x-target.x,rig.camera.position.z-target.z);
 const options=[behind-sideAngle,behind+sideAngle];
 const wanted=options.reduce((a,b)=>Math.abs(angleDelta(current,a))<=Math.abs(angleDelta(current,b))?a:b);
 const change=angleDelta(current,wanted)*(1-Math.exp(-dt*SPECTATOR_FRAMING.responsePerSecond));
 const limit=dt*SPECTATOR_FRAMING.maxOrbitRadiansPerSecond;
 const yaw=rig.freshCamera?wanted:current+MathUtils.clamp(change,-limit,limit);
 rig.spectatorOrbit={id:bike.id,yaw};
 rig.desired.x=target.x+Math.sin(yaw)*radius;rig.desired.z=target.z+Math.cos(yaw)*radius;
 const aim=target.clone().sub(rig.desired).normalize().add(other.clone().sub(rig.desired).normalize()).normalize();
 rig.lookDesired.copy(rig.desired).addScaledVector(aim,Math.max(1,radius));
 return true;
}
