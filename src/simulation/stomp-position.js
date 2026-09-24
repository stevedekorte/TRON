import {worldFor} from '../levels/scenario.js';
import {angleDelta} from '../game/config.js';
import {TACTICAL} from '../game/tactical.js';
import {CRUSH} from './crush.js';
import {AIR_HULL,aircraftPoseClear} from './maneuver-geometry.js';

// A bounded search around the predicted contact, including exact wall headings.
// Leave room inside the attack trigger for the controller's arrival tolerance.
export const STOMP_POSITION=Object.freeze({directions:16,rings:2,arrivalMeters:.35,turnWeightMeters:1});
export function stompLanding(e,target){
 const world=worldFor(e),radius=CRUSH.triggerDistance-STOMP_POSITION.arrivalMeters*2;
 const walls=world.nearbyWalls(target.x,target.s,radius+Math.hypot(AIR_HULL.halfWidth,AIR_HULL.halfDepth)+TACTICAL.clearance);
 const headings=[e.yaw];
 for(let i=0;i<8;i++)headings.push(i*Math.PI/4);
 for(const wall of walls)for(let i=0;i<wall.points.length;i++){
  const a=wall.points[i],b=wall.points[(i+1)%wall.points.length];
  const yaw=Math.atan2(b.s-a.s,b.x-a.x);
  if(!headings.some(h=>Math.abs(angleDelta(h,yaw))<.001))headings.push(yaw,yaw+Math.PI);
 }
 const offsets=[{x:0,s:0}];
 for(let ring=1;ring<=STOMP_POSITION.rings;ring++)for(let i=0;i<STOMP_POSITION.directions;i++){
  const angle=i*Math.PI*2/STOMP_POSITION.directions,r=radius*ring/STOMP_POSITION.rings;
  offsets.push({x:Math.cos(angle)*r,s:Math.sin(angle)*r});
 }
 let best=null,score=Infinity;
 for(const offset of offsets)for(const yaw of headings){
  const cost=Math.hypot(offset.x,offset.s)+Math.abs(angleDelta(e.yaw,yaw))*STOMP_POSITION.turnWeightMeters;
  if(cost>=score)continue;
  const pose={x:target.x+offset.x,s:target.s+offset.s,y:CRUSH.soleHeight,yaw};
  if(aircraftPoseClear(pose,walls,TACTICAL.clearance,world)){best=pose;score=cost;}
 }
 return best;
}
