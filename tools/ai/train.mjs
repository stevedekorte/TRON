import {APPROACH} from './approach.mjs';
// Reproducible exploration, followed by paired held-out evaluation. Never promotes itself.
import {Worker} from 'node:worker_threads';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {DEFAULT_POLICY,POLICY_BOUNDS,validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
import {AI_FITNESS} from './fitness.mjs';
import {match} from './benchmark.mjs';
const options={population:4,generations:2,trainSeeds:4,heldOutSeeds:8,seconds:180,workers:3,seedOffset:310000};
for(const key of Object.keys(options)){const arg=process.argv.find(a=>a.startsWith(`--${key}=`));if(arg)options[key]=Number(arg.split('=')[1]);if(!Number.isInteger(options[key])||options[key]<1)throw Error(`Invalid ${key}`);}
const artifact=process.argv.find(a=>a.startsWith('--artifact='))?.slice(11)??'cycle-ai-trained';
if(!/^[a-z0-9-]+$/.test(artifact))throw Error('Invalid artifact name');
const initialPath=process.argv.find(a=>a.startsWith('--initial='))?.slice(10);
const initialPolicy=initialPath?validatePolicy(JSON.parse(await readFile(initialPath,'utf8')).policy):DEFAULT_POLICY;
let rng=(44123+options.seedOffset)>>>0;const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
function mutate(parent,id){const p={...parent,id};for(const [key,[min,max]] of Object.entries(POLICY_BOUNDS))p[key]=Math.max(min,Math.min(max,parent[key]+(random()-.5)*(max-min)*.3));return validatePolicy(p);}
function evaluate(policy,seeds,opponents,label){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./tournament-worker.mjs',import.meta.url),{workerData:{policy,seeds,opponents,seconds:options.seconds,label}});
 worker.on('message',m=>{if(m.result)resolve(m.result);else console.log(JSON.stringify(m));});worker.on('error',reject);worker.on('exit',code=>{if(code)reject(Error(`Worker exited ${code}`));});
});}
async function pool(items,fn){let cursor=0;const results=Array(items.length);await Promise.all(Array.from({length:Math.min(options.workers,items.length)},async()=>{while(cursor<items.length){const i=cursor++;results[i]=await fn(items[i],i);}}));return results;}
// Timing is measured serially after parallel matches, never under tournament contention.
function timing(policy){const result=match({seed:71000,mode:'bounded',seconds:options.seconds,policies:Array(4).fill(policy),measure:true});return {aiMs:result.aiMs,tickMs:result.tickMs,passes:result.aiMs.p99<=1&&result.tickMs.p99<1000/120};}
await mkdir('test-results',{recursive:true});
const history=initialPolicy.id===DEFAULT_POLICY.id?[DEFAULT_POLICY]:[DEFAULT_POLICY,initialPolicy],generations=[];let champion=initialPolicy;
for(let g=0;g<options.generations;g++){
 const policies=[champion,...Array.from({length:options.population-1},(_,i)=>mutate(champion,`approach-${options.seedOffset}-${g}-${i}`))],seeds=Array.from({length:options.trainSeeds},(_,i)=>options.seedOffset+10000+g*100+i);
 const scores=await pool(policies,async policy=>({policy,result:await evaluate(policy,seeds,history,`g${g}:${policy.id}`)}));
 scores.sort((a,b)=>b.result.fitness-a.result.fitness||b.result.winRate-a.result.winRate);
 for(const entry of scores){entry.timing=timing(entry.policy);if(entry.timing.passes){champion=entry.policy;break;}}
 history.push(champion);generations.push(scores);
 console.log(JSON.stringify({generation:g,champion:champion.id,scores:scores.map(e=>({id:e.policy.id,...e.result,rows:undefined,timing:e.timing}))}));
 await writeFile(`test-results/${artifact}-checkpoint.json`,JSON.stringify({options,initialPolicy,fitnessWeights:AI_FITNESS,approachConfig:APPROACH,generations,champion},null,2));
}
const seeds=Array.from({length:options.heldOutSeeds},(_,i)=>options.seedOffset+90000+i);
// Identical fixed opponents, seeds, and spawn rotations for both policies.
const [candidate,baseline]=await pool([champion,DEFAULT_POLICY],p=>evaluate(p,seeds,[DEFAULT_POLICY],`heldout:${p.id}`));
const previous=initialPolicy.id===champion.id?candidate:initialPolicy.id===DEFAULT_POLICY.id?baseline:await evaluate(initialPolicy,seeds,[DEFAULT_POLICY],`heldout:${initialPolicy.id}`);
const paired=seeds.map(seed=>{const a=candidate.rows.filter(r=>r.seed===seed),b=baseline.rows.filter(r=>r.seed===seed);return {seed,fitnessDelta:a.reduce((s,r,i)=>s+r.fitness-b[i].fitness,0)/4,killDelta:a.reduce((s,r,i)=>s+r.kills-b[i].kills,0)/4,assistDelta:a.reduce((s,r,i)=>s+r.assists-b[i].assists,0)/4};});
const output={version:1,options,initialPolicy,fitnessWeights:AI_FITNESS,approachConfig:APPROACH,policy:champion,generations,heldOut:{candidate,baseline,previous,paired},timing:timing(champion),promoted:false,note:'Exploratory run. Seed is the comparison unit; four spawn rotations are correlated. Requires gameplay review. Parallel matches are not performance measurements.'};
await writeFile(`test-results/${artifact}.json`,JSON.stringify(output,null,2));console.log(JSON.stringify({artifact:`test-results/${artifact}.json`,champion:champion.id,candidate:{...candidate,rows:undefined},baseline:{...baseline,rows:undefined},previous:{...previous,rows:undefined},paired,timing:output.timing,promoted:false}));
