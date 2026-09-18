import {MAZE_INSTANCES,MAZE_LENGTH,OPEN_CELLS,freePosition} from '../levels/maze.js';
export const DATA_BEAM={radius:7,height:100000,fadeSeconds:1.5,wallClearance:20,stopSpeed:.3,buildSeconds:1.2,holdSeconds:2.5,retractSeconds:1.2};
export function createDataBeams(random){
 const used=new Set();
 return MAZE_INSTANCES.map(m=>{
  const candidates=OPEN_CELLS.filter(p=>p.mazeId===m.id&&Math.hypot(p.x-m.x,p.s-m.s)<MAZE_LENGTH*.28&&freePosition(p.x,p.s,DATA_BEAM.wallClearance)&&!used.has(`${p.c},${p.r}`));
  if(!candidates.length)throw new Error(`No clear central data-beam site in maze ${m.id}`);
  const p=candidates[Math.floor(random()*candidates.length)];used.add(`${p.c},${p.r}`);
  return {id:m.id,x:p.x,s:p.s,collectedAt:null,transferStartedAt:null};
 });
}
export function collectData(run){
 for(const beam of run.dataBeams){
  if(beam.collectedAt!==null)continue;
  const stopped=!run.crushed&&Math.abs(run.speed)<=DATA_BEAM.stopSpeed&&Math.hypot(run.x-beam.x,run.s-beam.s)<=DATA_BEAM.radius;
  if(!stopped){beam.transferStartedAt=null;continue;}
  if(beam.transferStartedAt===null){beam.transferStartedAt=run.time;beam.transferX=run.x;beam.transferS=run.s;}
  if(run.time-beam.transferStartedAt<DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds+DATA_BEAM.retractSeconds)continue;
  beam.collectedAt=run.time;run.dataCollected++;
  run.events.push({type:'dataCollected',id:beam.id,x:beam.x,s:beam.s,y:0});
 }
}
