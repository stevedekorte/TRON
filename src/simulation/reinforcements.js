import {tacticalEnabled} from './tactical.js';
import {createRecognizers,inheritNearbyAwareness} from './recognizers.js';
import {materializationDuration} from '../game/materialization.js';
import {RECOGNIZER_SCALE} from '../game/config.js';
import {WALL_HEIGHT} from '../levels/maze.js';
export const REINFORCEMENTS=Object.freeze({pursuitSeconds:20,spawnDistance:65,clearance:40,attempts:16});
export function updateReinforcements(run,dt){
 for(const e of run.recognizers)if(e.state==='materializing'&&run.time-e.rezStarted>=materializationDuration()){
  inheritNearbyAwareness(e,run);
 }
 if(tacticalEnabled()){run.pursuitSeconds=0;return;}
 const pursuers=run.recognizers.filter(e=>e.health>0&&!e.targetGone&&!e.teleport&&e.state!=='destroyed'&&e.state!=='materializing'&&e.memory&&(e.canSee||e.state==='pursue'));
 if(run.crushed||!pursuers.length){run.pursuitSeconds=0;return;}
 run.pursuitSeconds=(run.pursuitSeconds||0)+dt;
 if(run.pursuitSeconds+1e-8<REINFORCEMENTS.pursuitSeconds)return;
 const count=run.reinforcementsSpawned||0,source=pursuers[count%pursuers.length];
 let position;
 for(let i=0;i<REINFORCEMENTS.attempts;i++){
  const angle=source.yaw+Math.PI/2+i*2.399963229728653;
  const radius=REINFORCEMENTS.spawnDistance*(1+Math.floor(i/8));
  const p={x:source.x+Math.cos(angle)*radius,s:source.s+Math.sin(angle)*radius,y:Math.max(source.y,WALL_HEIGHT+22*RECOGNIZER_SCALE+12)};
  if(run.recognizers.every(e=>e.teleport||e.state==='destroyed'||Math.hypot(e.x-p.x,e.s-p.s,e.y-p.y)>=REINFORCEMENTS.clearance)){position=p;break;}
 }
 if(!position)return;
 const e=createRecognizers(()=>.5)[0];
 Object.assign(e,position,{id:1000+count,role:'reinforcement',mazeId:source.mazeId??0,yaw:source.yaw,state:'materializing',rezStarted:run.time,vx:0,vs:0,vy:0,yawVelocity:0,seed:(source.seed+count+1)>>>0,
  memory:{...source.memory},canSee:false,nextSense:run.time+materializationDuration(),alertUntil:source.alertUntil});
 run.recognizers.push(e);run.reinforcementsSpawned=count+1;run.pursuitSeconds=0;
}
