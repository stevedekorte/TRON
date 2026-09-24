import {RECOGNIZER_SCALE} from '../game/config.js';
import {CARRIER} from '../game/carrier.js';

// Approximate hollow construction: kg/m³. Energy in joules; health is shared
// with bullets. Only closing speed along the contact normal does damage.
export const DEBRIS_DAMAGE={density:60,thresholdJoules:5000,joulesPerHealth:50000,recontactSeconds:.5};
export function impactDamage(energy){return Number.isFinite(energy)?Math.max(0,energy-DEBRIS_DAMAGE.thresholdJoules)/DEBRIS_DAMAGE.joulesPerHealth:0;}
const tankBoxes=[{center:[0,1,0],half:[3.3,1,4.5]},{center:[0,2.2,0],half:[2.3,.7,2.5]}];
export function debrisVehicleTargets(run){
 const target=(key,e,boxes,y=e.y||0)=>({key,x:e.x,y,z:-e.s,yaw:e.yaw||0,velocity:{x:e.vx||0,y:e.vy||0,z:-(e.vs||0)},boxes});
 const targets=[];
 if(!run.crushed&&!run.teleport)targets.push(target('clu',{...run,vx:-Math.sin(run.yaw)*run.speed,vs:Math.cos(run.yaw)*run.speed},tankBoxes,0));
 for(const e of [...run.recognizers,...run.enemyTanks]){
  if(e.teleport||e.state==='destroyed'||e.state==='materializing'||e.health<=0)continue;
  if(e.kind==='ground'){targets.push(target(`enemy:${e.id}`,e,tankBoxes,0));continue;}
  const scale=RECOGNIZER_SCALE,box=(center,half)=>({center:center.map(v=>v*scale),half:half.map(v=>v*scale)});
  const legX=13.5-(e.fold||0)*13;
  targets.push(target(`enemy:${e.id}`,e,[box([0,.5,0],[18,4.5,4.35]),box([0,6.5,0],[7,1.5,4.35]),box([-legX,-13,0],[3.5,9,4.35]),box([legX,-13,0],[3.5,9,4.35])]));
 }
 if(run.carrierHealth>0)targets.push(target('carrier',{x:CARRIER.startX+CARRIER.speed*run.time,y:CARRIER.altitude,s:CARRIER.s,vx:CARRIER.speed},[{center:[0,0,0],half:[612,101,139]}]));
 return targets;
}
export function applyDebrisImpacts(run,impacts){
 for(const impact of impacts){
  const damage=impactDamage(impact.energy);if(!damage)continue;
  const {x,y,z}=impact.point,hit={x,y,z};
  if(impact.target==='carrier'){
   if(run.carrierHealth<=0)continue;
   run.carrierHealth=Math.max(0,run.carrierHealth-damage);run.carrierHitAt=run.time;
   run.events.push({type:'hit',subject:'carrier',x,y,s:-z,damage,source:'debris'});continue;
  }
  const clu=impact.target==='clu',e=clu?run:[...run.recognizers,...run.enemyTanks].find(e=>`enemy:${e.id}`===impact.target);
  if(!e||clu&&(run.inspection||run.crushed||run.teleport)||e.teleport||e.state==='destroyed'||e.state==='materializing'||e.health<=0)continue;
  // A Recognizer's stomp can crush wreckage (including its victim's debris)
  // without taking landing damage. Weapon damage remains independent.
  if(!clu&&e.kind!=='ground'&&['drop','hold'].includes(e.attack?.phase))continue;
  e.health=Math.max(0,e.health-damage);if(clu)run.impact=1;else e.hit=1;
  const subject=clu?'tank':e.kind==='ground'?'enemyTank':'recognizer';
  run.events.push({type:'hit',subject,id:e.id,x,y,s:-z,damage,fatal:e.health===0,source:'debris'});
  if(e.health>0)continue;
  const speed=e.speed||0;
  if(clu){run.crushed=true;run.speed=0;}else{e.state='destroyed';e.canSee=false;e.memory=null;run.kills++;}
  run.events.push({type:'destroyed',subject,id:e.id,x:e.x,y:subject==='recognizer'?e.y:0,s:e.s,yaw:e.yaw,turretYaw:e.turretYaw,fold:e.fold||0,
   vx:clu?-Math.sin(e.yaw)*speed:e.vx,vs:clu?Math.cos(e.yaw)*speed:e.vs,vy:e.vy||0,hit,source:'debris'});
 }
}
