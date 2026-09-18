import {MAZE_INSTANCES,MAZE_LENGTH,OPEN_CELLS,freePosition} from '../levels/maze.js';
export const DATA_BEAM={radius:7,height:100000,fadeSeconds:1.5,wallClearance:20};
export function createDataBeams(random){
 const used=new Set();
 return MAZE_INSTANCES.map(m=>{
  const candidates=OPEN_CELLS.filter(p=>p.mazeId===m.id&&Math.hypot(p.x-m.x,p.s-m.s)<MAZE_LENGTH*.28&&freePosition(p.x,p.s,DATA_BEAM.wallClearance)&&!used.has(`${p.c},${p.r}`));
  if(!candidates.length)throw new Error(`No clear central data-beam site in maze ${m.id}`);
  const p=candidates[Math.floor(random()*candidates.length)];used.add(`${p.c},${p.r}`);
  return {id:m.id,x:p.x,s:p.s,collectedAt:null};
 });
}
export function collectData(run,previous){
 if(run.crushed)return;
 const dx=run.x-previous.x,ds=run.s-previous.s,length2=dx*dx+ds*ds;
 for(const beam of run.dataBeams){
  if(beam.collectedAt!==null)continue;
  const t=length2?Math.max(0,Math.min(1,((beam.x-previous.x)*dx+(beam.s-previous.s)*ds)/length2)):0;
  if(Math.hypot(previous.x+dx*t-beam.x,previous.s+ds*t-beam.s)>DATA_BEAM.radius)continue;
  beam.collectedAt=run.time;run.dataCollected++;
  run.events.push({type:'dataCollected',id:beam.id,x:beam.x,s:beam.s,y:0});
 }
}
