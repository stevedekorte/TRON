import {inheritNearbyAwareness} from './recognizers.js';
export {TELEPORT_PADS,TELEPORTERS,createTeleportPads} from '../levels/teleporters.js';
import {RECOGNIZER_SCALE} from '../game/config.js';
import {TANK} from '../game/tank.js';
import {materializationDuration} from '../game/materialization.js';

export function vehicleFootprint(e,airborne=false){
 const points=[],box=(minX,maxX,minZ,maxZ,yaw=0,px=0,pz=0)=>{
  for(const x of [minX,maxX])for(const z of [minZ,maxZ]){
   const lx=px+Math.cos(yaw)*x+Math.sin(yaw)*z,lz=pz-Math.sin(yaw)*x+Math.cos(yaw)*z;
   points.push({x:e.x+Math.cos(e.yaw)*lx+Math.sin(e.yaw)*lz,s:e.s+Math.sin(e.yaw)*lx-Math.cos(e.yaw)*lz});
  }
 };
 if(airborne)box(-18*RECOGNIZER_SCALE,18*RECOGNIZER_SCALE,-4.35*RECOGNIZER_SCALE,4.35*RECOGNIZER_SCALE);
 else{box(-3.3,3.3,-4.5,4.5);box(-3.635,1.556,-7.537,4.161,e.turretYaw||0,TANK.pivot[0],TANK.pivot[2]);}
 return points;
}
export function fullyInsidePad(e,pad,airborne=false){return vehicleFootprint(e,airborne).every(p=>Math.abs(p.x-pad.x)<=pad.size/2&&Math.abs(p.s-pad.s)<=pad.size/2);}
function overlapsPad(e,pad,airborne){
 const points=vehicleFootprint(e,airborne),h=pad.size/2;
 return Math.min(...points.map(p=>p.x))<=pad.x+h&&Math.max(...points.map(p=>p.x))>=pad.x-h&&Math.min(...points.map(p=>p.s))<=pad.s+h&&Math.max(...points.map(p=>p.s))>=pad.s-h;
}
export function teleportEffectAge(e,time){
 if(!e.teleport)return null;
 const age=Math.max(0,time-e.teleport.started),duration=materializationDuration();
 return e.teleport.phase==='out'?Math.max(0,duration-age):Math.min(duration,age);
}
export function updateTeleporters(run){
 const vehicles=[{e:run,air:false},...run.enemyTanks.map(e=>({e,air:false})),...run.recognizers.map(e=>({e,air:true}))];
 const live=vehicles.filter(({e})=>!e.crushed&&e.state!=='destroyed'&&e.health>0);
 const pads=run.teleportPads,duration=materializationDuration();
 for(const {e,air} of live){
  if(e.teleport){
   const t=e.teleport;if(run.time-t.started+1e-8<duration)continue;
   if(t.phase==='out'){
    const dest=pads.find(p=>p.id===t.destination);
    if(live.some(v=>v.e!==e&&overlapsPad(v.e,dest,v.air)))continue;
    e.x=dest.x;e.s=dest.s;t.phase='in';t.started=run.time;
    e.teleportArrival=dest.id;e.teleportRevision=(e.teleportRevision||0)+1;
    if(e!==run){e.mazeId=dest.mazeId;e.goal=null;e.patrolGoal=null;e.goalUntil=0;e.path=[];e.nextRoute=0;}
   }else{
    if(e!==run)inheritNearbyAwareness(e,run);
    e.teleport=null;
   }
   continue;
  }
  if(e.state==='materializing'||e.transferActive)continue;
  const arrival=pads.find(p=>p.id===e.teleportArrival);
  if(arrival){if(overlapsPad(e,arrival,air))continue;e.teleportArrival=null;}
  const pad=pads.find(p=>fullyInsidePad(e,p,air));if(!pad)continue;
  const dest=pads.find(p=>p.id===pad.destination);if(!dest||dest.mazeId===pad.mazeId)continue;
  // Reserve the entire destination column, including incoming vehicles.
  if(live.some(v=>v.e!==e&&(v.e.teleport?.destination===dest.id||overlapsPad(v.e,dest,v.air))))continue;
  e.teleport={phase:'out',started:run.time,source:pad.id,destination:dest.id};
  e.speed=0;e.vx=0;e.vs=0;e.vy=0;e.yawVelocity=0;e.steer=0;
  if(e===run){e.cruiseThrottle=false;e.turboRemaining=0;e.gunner=false;}
  else{e.state='teleporting';e.canSee=false;e.attack=null;e.spotlight=null;e.tactical=null;e.hearing=[];e.nextHearingReplan=0;}
 }
}
