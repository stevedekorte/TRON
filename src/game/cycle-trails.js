import {LIGHT_CYCLES as C,cycleFraction} from './light-cycles.js';
import {ARENA_WALL} from './arena-breaches.js';

export const CYCLE_TRAIL_LIMIT=Object.freeze({lengthMeters:8*ARENA_WALL.innerMeters});
export const cycleTrailLength=t=>Math.hypot(t.x2-t.x1,t.z2-t.z1)*C.cellMeters;
export function cycleTrailHeadTrim(r,b,fraction=cycleFraction(r,b)){
 if(!b.alive||b.escaped)return 0;
 const active=r.trails[b.segment];
 const span=active?.initial?0:active?.joining?cycleTrailLength(active):C.cellMeters;
 let runLength=0;
 for(let i=b.segment;i>=0;i--){
  const t=r.trails[i];if(!t||t.bikeId!==b.id)continue;
  runLength+=cycleTrailLength(t);if(t.startsRun)break;
 }
 return Math.min(runLength,(1-fraction)*span+C.lengthMeters*.347);
}
