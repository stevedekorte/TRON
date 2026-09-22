import {inheritNearbyAwareness} from './recognizers.js';
export {TELEPORT_PADS,TELEPORTERS,createTeleportPads} from '../levels/teleporters.js';
import {RECOGNIZER_SCALE} from '../game/config.js';
import {TANK} from '../game/tank.js';
import {TELEPORTERS} from '../levels/teleporters.js';
export const TELEPORT_VEHICLE_BOUNDS=Object.freeze({tankHeight:3.5,airBottom:22*RECOGNIZER_SCALE,airTop:8*RECOGNIZER_SCALE});

export function vehicleFootprint(e,airborne=false){
 const points=[],box=(minX,maxX,minZ,maxZ,yaw=0,px=0,pz=0)=>{
  for(const x of [minX,maxX])for(const z of [minZ,maxZ]){
   const lx=px+Math.cos(yaw)*x+Math.sin(yaw)*z,lz=pz-Math.sin(yaw)*x+Math.cos(yaw)*z;
   points.push({x:e.x+Math.cos(e.yaw)*lx+Math.sin(e.yaw)*lz,s:e.s+Math.sin(e.yaw)*lx-Math.cos(e.yaw)*lz});
  }
 };
 if(airborne)box(-18*RECOGNIZER_SCALE,18*RECOGNIZER_SCALE,-6.5*RECOGNIZER_SCALE,6.5*RECOGNIZER_SCALE);
 else{box(-3.3,3.3,-4.5,4.5);box(-3.635,1.556,-7.537,4.161,e.turretYaw||0,TANK.pivot[0],TANK.pivot[2]);}
 return points;
}
export function vehicleAltitude(e,airborne=false){
 return airborne?{min:(e.y||0)-TELEPORT_VEHICLE_BOUNDS.airBottom,max:(e.y||0)+TELEPORT_VEHICLE_BOUNDS.airTop}:{min:0,max:TELEPORT_VEHICLE_BOUNDS.tankHeight};
}
export function fullyInsidePad(e,pad,airborne=false){
 const y=vehicleAltitude(e,airborne);
 return y.min>=0&&y.max<=(pad.height??TELEPORTERS.height)&&vehicleFootprint(e,airborne).every(p=>Math.abs(p.x-pad.x)<=pad.size/2&&Math.abs(p.s-pad.s)<=pad.size/2);
}
export function overlapsPad(e,pad,airborne=false){
 const points=vehicleFootprint(e,airborne),h=pad.size/2,y=vehicleAltitude(e,airborne);
 return y.max>=0&&y.min<=(pad.height??TELEPORTERS.height)&&Math.min(...points.map(p=>p.x))<=pad.x+h&&Math.max(...points.map(p=>p.x))>=pad.x-h&&Math.min(...points.map(p=>p.s))<=pad.s+h&&Math.max(...points.map(p=>p.s))>=pad.s-h;
}
export function vehicleTeleportPad(e,pads,airborne=false){
 if(e.crushed||e.state==='destroyed'||e.state==='materializing')return null;
 return pads.find(p=>overlapsPad(e,p,airborne))||null;
}
export function updateTeleporters(run){
 const vehicles=[{e:run,air:false},...run.enemyTanks.map(e=>({e,air:false})),...run.recognizers.map(e=>({e,air:true}))];
 const live=vehicles.filter(({e})=>!e.crushed&&e.state!=='destroyed'&&e.health>0),pads=run.teleportPads;
 for(const {e,air} of live){
  if(e.state==='materializing'||e.transferActive)continue;
  const arrival=pads.find(p=>p.id===e.teleportArrival);
  if(arrival){if(overlapsPad(e,arrival,air))continue;e.teleportArrival=null;}
  const pad=pads.find(p=>fullyInsidePad(e,p,air));if(!pad)continue;
  const dest=pads.find(p=>p.id===pad.destination);if(!dest||dest.mazeId===pad.mazeId)continue;
  // Transfer atomically in simulation order. Earlier arrivals occupy the destination
  // immediately, so two vehicles cannot reserve/enter the same column this step.
  if(live.some(v=>v.e!==e&&overlapsPad(v.e,dest,v.air)))continue;
  const target={...e,x:dest.x+e.x-pad.x,s:dest.s+e.s-pad.s};
  if(!fullyInsidePad(target,dest,air))continue;
  const departure={x:e.x,s:e.s,y:air?e.y:2};
  e.x=target.x;e.s=target.s;
  run.events.push({type:'teleport',phase:'departure',player:e===run,id:e.id,...departure},
   {type:'teleport',phase:'arrival',player:e===run,id:e.id,x:e.x,s:e.s,y:air?e.y:2});
  e.teleportArrival=dest.id;e.teleportRevision=(e.teleportRevision||0)+1;
  pad.lastTransfer=dest.lastTransfer=run.time;
  if(e!==run){
   e.mazeId=dest.mazeId;e.goal=null;e.patrolGoal=null;e.goalUntil=0;e.path=[];e.nextRoute=0;
   e.canSee=false;e.attack=null;e.spotlight=null;e.tactical=null;e.hearing=[];e.nextHearingReplan=0;
   inheritNearbyAwareness(e,run);
  }
 }
}
