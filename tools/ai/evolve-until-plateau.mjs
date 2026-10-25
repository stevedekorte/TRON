import {APPROACH} from './approach.mjs';
// Start from the frozen playtested policy. Stop on a predeclared validation plateau.
import {Worker} from 'node:worker_threads';
import {writeFile,mkdir} from 'node:fs/promises';
import {PLAYTESTED_POLICY} from '../../shared/simulation/cycle-ai/policies/aggression-v3.js';
import {BASELINE_POLICY as DEFAULT_POLICY,POLICY_BOUNDS,validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
import {AI_FITNESS} from './fitness.mjs';
import {match} from './benchmark.mjs';
const fastWins=process.argv.includes('--fast-wins');
const options={population:4,trainSeeds:4,validationSeeds:4,finalSeeds:8,seconds:180,workers:3,patience:3,minGain:.02,seedOffset:fastWins?200000:0,mutationSeed:fastWins?882913:772913};
const artifact=fastWins?'cycle-ai-fast-wins':'cycle-ai-plateau';
const initial=PLAYTESTED_POLICY;
await mkdir('test-results',{recursive:true});
let champion=validatePolicy(initial),rng=options.mutationSeed,stale=0,generation=0;
const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
function mutate(parent,id){const p={...parent,id};for(const [key,[min,max]] of Object.entries(POLICY_BOUNDS))p[key]=Math.max(min,Math.min(max,parent[key]+(random()-.5)*(max-min)*.3));return validatePolicy(p);}
function evaluate(policy,seeds,opponents,label){return new Promise((resolve,reject)=>{
 const w=new Worker(new URL('./tournament-worker.mjs',import.meta.url),{workerData:{policy,seeds,opponents,seconds:options.seconds,label}});
 w.on('message',m=>{if(m.result)resolve(m.result);else console.log(JSON.stringify(m));});w.on('error',reject);w.on('exit',code=>{if(code)reject(Error(`Worker exit ${code}`));});
});}
async function pool(items,fn){let cursor=0;const results=Array(items.length);await Promise.all(Array.from({length:Math.min(options.workers,items.length)},async()=>{while(cursor<items.length){const i=cursor++;results[i]=await fn(items[i],i);}}));return results;}
function timing(policy){const r=match({seed:72000,mode:'bounded',seconds:180,policies:Array(4).fill(policy),measure:true});return {aiMs:r.aiMs,tickMs:r.tickMs,passes:r.aiMs.p99<=1&&r.tickMs.p99<1000/120};}
const seeds=Array.from({length:options.validationSeeds},(_,i)=>options.seedOffset+40000+i),history=[DEFAULT_POLICY,champion],records=[];
let validation=await evaluate(champion,seeds,[DEFAULT_POLICY],'initial-validation');
const initialValidation=validation;
while(stale<options.patience){
 const trainSeeds=Array.from({length:options.trainSeeds},(_,i)=>options.seedOffset+20000+generation*100+i);
 const candidates=[champion,...Array.from({length:options.population-1},(_,i)=>mutate(champion,`${fastWins?'fast-win':'plateau'}-${generation}-${i}`))];
 const scores=await pool(candidates,async p=>({policy:p,result:await evaluate(p,trainSeeds,history,`g${generation}:${p.id}`)}));
 scores.sort((a,b)=>b.result.fitness-a.result.fitness||b.result.winRate-a.result.winRate);
 const chosen=scores[0];let challenger=null,check=null,gain=0,improvedSeeds=0,accepted=false;
 if(chosen.policy.id!==champion.id){
  challenger=await evaluate(chosen.policy,seeds,[DEFAULT_POLICY],`validation:${chosen.policy.id}`);
  gain=challenger.fitness-validation.fitness;
  for(const seed of seeds){const sum=r=>r.rows.filter(x=>x.seed===seed).reduce((n,x)=>n+x.fitness,0);if(sum(challenger)>sum(validation)+1e-9)improvedSeeds++;}
  if(gain>=options.minGain&&improvedSeeds>=3){check=timing(chosen.policy);accepted=check.passes;}
 }
 if(accepted){champion=chosen.policy;validation=challenger;history.push(champion);stale=0;}else stale++;
 records.push({generation,scores,challenger,timing:check,gain,improvedSeeds,accepted,stale,champion:champion.id});
 console.log(JSON.stringify({generation,champion:champion.id,gain,improvedSeeds,accepted,stale,validation:{...validation,rows:undefined}}));
 await writeFile(`test-results/${artifact}-checkpoint.json`,JSON.stringify({options,fitnessWeights:AI_FITNESS,approachConfig:APPROACH,initial,initialValidation,champion,validation,records,stale},null,2));
 generation++;
}
const finalSeeds=Array.from({length:options.finalSeeds},(_,i)=>options.seedOffset+100000+i);
const results=await pool([champion,initial,DEFAULT_POLICY],p=>evaluate(p,finalSeeds,[DEFAULT_POLICY],`final:${p.id}`));
const finalTiming=timing(champion),[candidate,previousTrial,baseline]=results;
const trialUpdated=champion.id!==initial.id&&finalTiming.passes&&candidate.fitness>previousTrial.fitness+options.minGain;
const output={version:1,options,fitnessWeights:AI_FITNESS,approachConfig:APPROACH,initial,initialValidation,policy:champion,validation,records,heldOut:{candidate,previousTrial,baseline},timing:finalTiming,stale,generations:generation,trialUpdated,promoted:false,
 note:'Observed plateau: three consecutive generations without >=0.02 validation fitness improvement across at least three of four seed groups and a runtime pass. Fixed validation is selection data, not held-out proof. Final seeds are used once. No production promotion.'};
await writeFile(`test-results/${artifact}.json`,JSON.stringify(output,null,2));
if(trialUpdated)await writeFile('test-results/cycle-ai-trained.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({complete:true,generations:generation,stale,champion:champion.id,trialUpdated,candidate:{...candidate,rows:undefined},previousTrial:{...previousTrial,rows:undefined},baseline:{...baseline,rows:undefined},timing:finalTiming}));
