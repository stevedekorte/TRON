// Offline only. Produces a candidate artifact; never changes the live policy.
import {writeFile,mkdir} from 'node:fs/promises';
import {match} from './benchmark.mjs';
import {DEFAULT_POLICY,POLICY_BOUNDS,validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
const smoke=process.argv.includes('--smoke'),neural=process.argv.includes('--neural');
const count=smoke?2:6,generations=smoke?1:3,seedCount=smoke?1:8,seconds=smoke?15:180;
let rng=44123;function random(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
function mutate(parent,id){
 const policy={...parent,id};
 for(const [key,[min,max]] of Object.entries(POLICY_BOUNDS))policy[key]=Math.max(min,Math.min(max,parent[key]+(random()-.5)*(max-min)*.15));
 if(neural){const old=parent.network?.weights;policy.network={version:1,weights:Array.from({length:545},(_,i)=>Math.max(-4,Math.min(4,(old?.[i]??0)+(random()-.5)*.1)))};}
 return validatePolicy(policy);
}
function evaluate(policy,seeds,opponents){
 let wins=0,draws=0,losses=0,aiP99=0,tickP99=0;
 for(const seed of seeds)for(let seat=0;seat<4;seat++){
  const policies=Array.from({length:4},(_,i)=>opponents[(seed+i)%opponents.length]);policies[seat]=policy;
  const result=match({seed,mode:'bounded',policies,seconds,measure:true});aiP99=Math.max(aiP99,result.aiMs.p99);tickP99=Math.max(tickP99,result.tickMs.p99);
  if(result.winner===seat)wins++;else if(result.winner===null||result.winner===undefined)draws++;else losses++;
 }
 const matches=wins+draws+losses,rate=wins/matches,z=1.96,lower=(rate+z*z/(2*matches)-z*Math.sqrt(rate*(1-rate)/matches+z*z/(4*matches*matches)))/(1+z*z/matches);
 return {wins,draws,losses,matches,winRate:rate,winRateLower95:lower,aiP99,tickP99,passesTiming:aiP99<=1&&tickP99<1000/120};
}
const history=[DEFAULT_POLICY],records=[];let champion=DEFAULT_POLICY;
for(let generation=0;generation<generations;generation++){
 const seeds=Array.from({length:seedCount},(_,i)=>10000+generation*100+i),policies=[champion,...Array.from({length:count-1},(_,i)=>mutate(champion,`candidate-${generation}-${i}`))];
 const scores=policies.map(policy=>({policy,result:evaluate(policy,seeds,history)}));
 scores.sort((a,b)=>Number(b.result.passesTiming)-Number(a.result.passesTiming)||b.result.winRate-a.result.winRate);
 if(scores[0].result.passesTiming){champion=scores[0].policy;history.push(champion);}
 records.push(scores.map(({policy,result})=>({id:policy.id,...result})));console.log(JSON.stringify({generation,results:records.at(-1)}));
}
const heldOut=evaluate(champion,Array.from({length:smoke?1:32},(_,i)=>90000+i),[DEFAULT_POLICY,...history]);
const output={version:1,policy:{...champion,...(champion.network?{network:{version:1,weights:Array.from(champion.network.weights)}}:{})},training:{seed:44123,seconds,records},heldOut,
 promoted:false,eligibleForReview:!smoke&&heldOut.passesTiming&&heldOut.winRateLower95>.25,
 note:'Not auto-promoted. Requires scenario regressions, held-out matched baseline comparison, browser performance and human gameplay review. Draws are not wins.'};
await mkdir('test-results',{recursive:true});
await writeFile('test-results/cycle-ai-candidate.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({artifact:'test-results/cycle-ai-candidate.json',heldOut,promoted:false}));
