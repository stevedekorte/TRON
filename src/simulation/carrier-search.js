import {CARRIER} from '../game/carrier.js';
import {MAZE_LENGTH,lineOfSight} from '../levels/maze.js';
export const CARRIER_SEARCH=Object.freeze({radioRadius:MAZE_LENGTH/2,radioInterval:1,radioDelay:.45,detectHalfLength:650,detectHalfWidth:180,trackRadius:800,turnRate:.8,lockAngle:.02,underside:102});
export function createCarrierSearch(){return {nextRadio:0,illuminated:false,lights:[-1,1].map(side=>({side,x:0,s:0,y:0,dx:0,dy:-1,ds:0,strength:0,target:null,tracking:false,lit:false}))};}
function turnToward(light,target,dt){
 const dx=target.x-light.x,dy=2.8-light.y,ds=target.s-light.s,length=Math.hypot(dx,dy,ds);
 const desired=[dx/length,dy/length,ds/length],current=[light.dx,light.dy,light.ds];
 const angle=Math.acos(Math.max(-1,Math.min(1,current.reduce((v,n,i)=>v+n*desired[i],0))));
 const t=angle>1e-6?Math.min(1,CARRIER_SEARCH.turnRate*dt/angle):1;
 const sin=Math.sin(angle),a=sin>1e-6?Math.sin((1-t)*angle)/sin:1-t,b=sin>1e-6?Math.sin(t*angle)/sin:t;
 const result=current.map((v,i)=>v*a+desired[i]*b),norm=Math.hypot(...result);
 [light.dx,light.dy,light.ds]=result.map(v=>v/norm);
 return Math.max(0,angle-CARRIER_SEARCH.turnRate*dt);
}
export function updateCarrierSearch(run,dt){
 const sensor=run.carrierSearch,center={x:CARRIER.startX+CARRIER.speed*run.time,s:CARRIER.s};
 const beneath=Math.abs(run.x-center.x)<=CARRIER_SEARCH.detectHalfLength&&Math.abs(run.s-center.s)<=CARRIER_SEARCH.detectHalfWidth;
 sensor.illuminated=false;
 for(const light of sensor.lights){
  light.x=center.x+light.side*240;light.s=center.s+light.side*55;light.y=CARRIER.altitude-CARRIER_SEARCH.underside;
  const inRange=Math.hypot(run.x-center.x,run.s-center.s)<CARRIER_SEARCH.trackRadius;
  const visible=run.carrierHealth>0&&!run.crushed&&inRange&&(beneath||light.tracking)&&lineOfSight(light,{x:run.x,s:run.s,y:2.8});
  light.tracking=visible;light.lit=false;
  if(visible){
   light.target={x:run.x,s:run.s,vx:-Math.sin(run.yaw)*run.speed,vs:Math.cos(run.yaw)*run.speed,seenAt:run.time,source:'carrier'};
   const error=turnToward(light,light.target,dt);
   light.lit=error<CARRIER_SEARCH.lockAngle&&light.strength>.25;
  }else light.target=null;
  light.strength+=(Number(visible)-light.strength)*(1-Math.exp(-dt*(visible?4:2.5)));
  if(run.crushed)light.strength=0;
  sensor.illuminated||=light.lit;
 }
 if(!sensor.illuminated||run.time<sensor.nextRadio)return;
 const sighting=sensor.lights.find(l=>l.lit).target;
 // Diameter is one maze width: use half that width as a horizontal radius.
 for(const e of [...run.recognizers,...run.enemyTanks]){
  if(e.state==='destroyed'||e.targetGone||Math.hypot(e.x-center.x,e.s-center.s)>CARRIER_SEARCH.radioRadius)continue;
  run.radio.push({to:e.id,deliverAt:run.time+CARRIER_SEARCH.radioDelay,sighting:{...sighting}});
 }
 sensor.nextRadio=run.time+CARRIER_SEARCH.radioInterval;
}
