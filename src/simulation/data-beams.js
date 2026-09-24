import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
const {MAZE_LENGTH}=DEFAULT_WORLD;
import {CLU_HEALTH,RECOGNIZER_SCALE} from '../game/config.js';
import {CARRIER,carrierFor} from '../game/carrier.js';
// Only panel formation/retraction are accelerated; the enclosed hold stays eleven seconds.
export const DATA_BEAM={radius:7,ringRadius:8.5,ringPanels:16,ringPanelGap:.2,ringPanelOpacity:.16,ringEdgeOpacity:.55,ringEdgeWidth:.035,height:100000,wallClearance:20,stopSpeed:.3,buildSeconds:1.5/3,holdSeconds:11,retractSeconds:3.5/3,get transferSeconds(){return this.buildSeconds+this.holdSeconds+this.retractSeconds;},blastEnabled:false,blastSeconds:4,blastRadius:MAZE_LENGTH/2,carrierDamage:25};
export function createDataBeams(random,world=DEFAULT_WORLD){
 const {MAZE_INSTANCES,MAZE_LENGTH,OPEN_CELLS,freePosition}=world;
 const used=new Set();
 return MAZE_INSTANCES.map(m=>{
  const candidates=OPEN_CELLS.filter(p=>p.mazeId===m.id&&Math.hypot(p.x-m.x,p.s-m.s)<MAZE_LENGTH*.28&&freePosition(p.x,p.s,DATA_BEAM.wallClearance)&&!used.has(`${p.c},${p.r}`));
  if(!candidates.length)throw new Error(`No clear central data-beam site in maze ${m.id}`);
  const p=m.beamPosition??candidates[Math.floor(random()*candidates.length)];
  if(!freePosition(p.x,p.s,DATA_BEAM.wallClearance))throw new Error(`Blocked authored beam position in maze ${m.id}`);used.add(`${p.c},${p.r}`);
  return {id:m.id,x:p.x,s:p.s,collectedAt:null,transferStartedAt:null,ringOpened:false,waveRadius:0,waveHits:[],waveDistances:{}};
 });
}

export function beginDataTransfer(run){
 if(run.crushed)return;
 for(const beam of run.dataBeams){
  if(beam.collectedAt===null&&beam.transferStartedAt===null&&Math.abs(run.speed)<=DATA_BEAM.stopSpeed&&Math.hypot(run.x-beam.x,run.s-beam.s)<=DATA_BEAM.radius){
   beam.transferStartedAt=run.time;
   beam.ringOpened=false;run.events.push({type:'dataTransfer',id:beam.id,x:beam.x,s:beam.s});
  }
 }
 run.transferActive=run.dataBeams.some(b=>b.collectedAt===null&&b.transferStartedAt!==null);
}
export function dataRingSweep(beam,time){
 if(beam.collectedAt!==null||beam.transferStartedAt===null)return 0;
 const age=time-beam.transferStartedAt,end=DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds;
 return age<0||age>=DATA_BEAM.transferSeconds?0:age<end?Math.min(1,age/DATA_BEAM.buildSeconds):Math.max(0,1-(age-end)/DATA_BEAM.retractSeconds);
}
function destroyEnemy(run,e){
 e.health=0;e.state='destroyed';e.canSee=false;e.memory=null;run.kills++;
 run.events.push({type:'destroyed',subject:e.kind==='ground'?'enemyTank':undefined,id:e.id,x:e.x,y:e.kind==='ground'?0:e.y,s:e.s,yaw:e.yaw,turretYaw:e.turretYaw,fold:e.fold||0,vx:e.vx,vs:e.vs,vy:e.vy});
}
export function damageRingContacts(run){
 for(const beam of run.dataBeams){
  const sweep=dataRingSweep(beam,run.time);if(!sweep)continue;
  for(const e of run.recognizers){
   if(e.teleport||e.state==='materializing'||e.state==='destroyed')continue;
   for(let i=0;i<DATA_BEAM.ringPanels&&sweep>i/DATA_BEAM.ringPanels;i++){
    const angle=i/DATA_BEAM.ringPanels*Math.PI*2;
    const dx=beam.x+Math.cos(angle)*DATA_BEAM.ringRadius-e.x;
    const dz=-(beam.s-e.s)+Math.sin(angle)*DATA_BEAM.ringRadius;
    const x=Math.cos(e.yaw)*dx-Math.sin(e.yaw)*dz,z=Math.sin(e.yaw)*dx+Math.cos(e.yaw)*dz;
    // Clip the panel's horizontal segment against the aircraft footprint.
    const halfWidth=(2*DATA_BEAM.ringRadius*Math.tan(Math.PI/DATA_BEAM.ringPanels)-DATA_BEAM.ringPanelGap)/2;
    const tx=-Math.sin(angle),tz=Math.cos(angle);
    const ux=Math.cos(e.yaw)*tx-Math.sin(e.yaw)*tz,uz=Math.sin(e.yaw)*tx+Math.cos(e.yaw)*tz;
    let lo=-halfWidth,hi=halfWidth;
    for(const [p,v,extent] of [[x,ux,18*RECOGNIZER_SCALE],[z,uz,4.35*RECOGNIZER_SCALE]]){
     if(Math.abs(v)<1e-8){if(Math.abs(p)>extent){lo=1;hi=0;break;}}
     else{const a=(-extent-p)/v,b=(extent-p)/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
    }
    if(lo<=hi){destroyEnemy(run,e);break;}
   }
  }
 }
}
export function updateDataWaves(run){
 const CARRIER=carrierFor(worldFor(run));
 if(!DATA_BEAM.blastEnabled)return;
 for(const beam of run.dataBeams){
  if(beam.collectedAt===null||run.time-beam.collectedAt>DATA_BEAM.blastSeconds+.2)continue;
  const previous=beam.waveRadius,radius=(worldFor(run).MAZE_LENGTH/2)*Math.min(1,Math.max(0,(run.time-beam.collectedAt)/DATA_BEAM.blastSeconds));
  function touches(id,distance){
   const last=beam.waveDistances[id]??distance;beam.waveDistances[id]=distance;
   if(beam.waveHits.includes(id)||last<previous||distance>radius)return false;
   beam.waveHits.push(id);return true;
  }
  for(const e of [...run.recognizers,...run.enemyTanks]){
   if(e.teleport||e.state==='materializing'||e.state==='destroyed')continue;
   const distance=Math.max(0,Math.hypot(e.x-beam.x,e.s-beam.s,e.kind==='ground'?2:e.y)-(e.kind==='ground'?3.5:12));
   if(!touches(e.id,distance))continue;
   destroyEnemy(run,e);
  }
  // Nearest point on the carrier's axis-aligned hull, not its distant center.
  const cx=CARRIER.startX+CARRIER.speed*run.time,cs=CARRIER.s;
  const dx=Math.max(0,Math.abs(cx-beam.x)-612),ds=Math.max(0,Math.abs(cs-beam.s)-139),dy=CARRIER.altitude-101;
  if(touches('carrier',Math.hypot(dx,dy,ds))){
   run.carrierHealth=Math.max(0,run.carrierHealth-DATA_BEAM.carrierDamage);run.carrierHitAt=run.time;
   run.events.push({type:'hit',subject:'carrier',x:Math.max(cx-612,Math.min(cx+612,beam.x)),s:Math.max(cs-139,Math.min(cs+139,beam.s)),y:dy,damage:DATA_BEAM.carrierDamage});
  }
  beam.waveRadius=radius;
 }
}
export function collectData(run,dt=0){
 run.transferActive=false;
 for(const beam of run.dataBeams){
  if(beam.collectedAt!==null||beam.transferStartedAt===null)continue;
  if(run.crushed||Math.hypot(run.x-beam.x,run.s-beam.s)>DATA_BEAM.radius){beam.transferStartedAt=null;continue;}
  run.transferActive=true;
  if(!beam.ringOpened&&run.time-beam.transferStartedAt>=DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds){beam.ringOpened=true;run.events.push({type:'dataRingOpen',id:beam.id,x:beam.x,s:beam.s});}
  run.health=Math.min(CLU_HEALTH.max,run.health+CLU_HEALTH.max*dt/DATA_BEAM.transferSeconds);
  if(run.time-beam.transferStartedAt<DATA_BEAM.transferSeconds)continue;
  beam.collectedAt=run.time;run.dataCollected++;run.transferActive=false;
  run.events.push({type:'dataCollected',id:beam.id,x:beam.x,s:beam.s,y:0});
 }
 if(!run.won&&!run.crushed&&run.dataBeams.length>0&&run.dataBeams.every(beam=>beam.collectedAt!==null)){
  run.won=true;run.speed=0;run.events.push({type:'victory'});
 }
 damageRingContacts(run);updateDataWaves(run);
}
