import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {arena} from './benchmark.mjs';
import {trackCycleTraps} from '../../shared/simulation/cycle-traps.js';
const race=arena(1982,'bounded'),barriers=[],times=[];
for(let i=0;i<2048;i++){
 const x=(i%64)*2.5-80,z=Math.floor(i/64)*5-80;
 barriers.push({trail:{bikeId:i%12},a:{x,z},end:{x:x+2,z}});
}
race.trails=barriers.map(b=>b.trail);
for(let i=0;i<500;i++){
 race.time+=.11;barriers[i%barriers.length].end.x+=.001;
 const start=performance.now();trackCycleTraps(race,barriers,[]);const elapsed=performance.now()-start;
 if(i>=50)times.push(elapsed);
}
times.sort((a,b)=>a-b);const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))];
console.log(JSON.stringify({hardware:os.cpus()[0].model,node:process.version,fixture:'12 cycles, 2048 trails, every call performs scheduled trap work',ms:{p50:q(.5),p95:q(.95),p99:q(.99),max:q(1)}}));
if(q(.99)>1)process.exitCode=1;
