import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {arena} from './benchmark.mjs';
import {planCycleAI,cycleAIDebug} from '../../shared/simulation/cycle-ai/controller.js';
const race=arena(1982,'bounded');race.trails=[];
if(process.argv.includes('--crowded'))for(const b of race.cycles){b.x=(b.id%4-1.5)*8;b.z=(Math.floor(b.id/4)-1)*10;b.dir=b.id%4;}
// Dense, changing short segments spanning the supported history cap. This is
// a planner-only stress fixture, not a claim about full collision tick cost.
for(let i=0;i<2048;i++){const x=(i%64)*2.5-80,z=Math.floor(i/64)*5-80;race.trails.push({bikeId:i%12,x1:x,z1:z,x2:x+1,z2:z});}
const samples=[];let maxTests=0,overflow=0;
for(let i=0;i<2400;i++){
 race.time+=1/120;race.elapsed+=1/120;race.trails[i%2048].x2+=.0001;const start=performance.now();planCycleAI(race);const elapsed=performance.now()-start;
 const stats=cycleAIDebug(race);if(i>=120)samples.push(elapsed);maxTests=Math.max(maxTests,stats.segmentTests);if(stats.overflow)overflow++;
}
samples.sort((a,b)=>a-b);const at=q=>samples[Math.min(samples.length-1,Math.floor(samples.length*q))];
const result={hardware:os.cpus()[0].model,node:process.version,platform:process.platform,fixture:'12 bots, 2048 moving segments',aiMs:{p50:at(.5),p95:at(.95),p99:at(.99),max:at(1)},maxTests,overflow};
console.log(JSON.stringify(result,null,2));if(at(.95)>.5||at(.99)>1)process.exitCode=1;
