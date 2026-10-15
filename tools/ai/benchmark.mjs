import {wallEliminationsByTeam,trapRewardsByTeam,OffenseEvents} from './fitness.mjs';
import {APPROACH,ApproachRewards} from './approach.mjs';
import {cycleAIDebug} from '../../shared/simulation/cycle-ai/controller.js';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resetCycleRound,updateCycleRace} from '../../shared/simulation/light-cycles.js';
export function arena(seed=1982,mode='classic',policies=null){
 const race={site:{x:0,s:0},seed,round:0,scores:[0,0,0,0],time:0,teamCount:4,cyclesPerTeam:3,closedArena:true,startWithBreach:false,hideMiddleOpponent:false,aiMode:mode};
 resetCycleRound(race);race.remaining=0;updateCycleRace(race,1/120);
 if(policies)for(const b of race.cycles){if(policies[b.team]==='classic')b.aiController='classic';else b.aiPolicy=policies[b.team];}
 return race;
}
export function match({seed=1982,mode='classic',seconds=180,policies=null,measure=false,approach=false}={}){
 const race=arena(seed,mode,policies);race.aiMeasure=measure;const times=[],ai=[];let steps=0;
 const pursuit=approach?new ApproachRewards(race.teamCount):null;let approachMs=0;
 const offense=approach?new OffenseEvents():null;
 const sample=()=>{const start=performance.now();pursuit.sample(race);approachMs+=performance.now()-start;};
 if(pursuit)sample();
 for(;steps<seconds*120&&race.phase==='racing';steps++){
  const start=measure?performance.now():0;updateCycleRace(race,1/120);
  if(measure){times.push(performance.now()-start);if(race.aiMetrics)ai.push(race.aiMetrics.milliseconds);}
  offense?.sample(race,(steps+1)/120);
  if(pursuit&&(steps+1)%Math.round(APPROACH.sampleSeconds*120)===0)sample();
 }
 const quantile=(a,q)=>a.length?a.sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))]:0;
 return {seed,mode,ticks:steps,seconds:steps/120,matchLimitSeconds:seconds,winner:race.winner,offenseEvents:offense?.events,wallEliminations:wallEliminationsByTeam(race),...trapRewardsByTeam(race),approach:pursuit?.scores,approachMs,approachSamples:pursuit?.samples??0,alive:race.cycles.filter(b=>b.alive).length,turns:race.cycles.reduce((s,b)=>s+b.turns,0),trailCount:race.trails.length,decisions:cycleAIDebug(race)?.totals,tickMs:{p50:quantile(times,.5),p95:quantile(times,.95),p99:quantile(times,.99),max:quantile(times,1)},aiMs:{p95:quantile(ai,.95),p99:quantile(ai,.99),max:quantile(ai,1)}};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'classic',count=Number(process.argv[3]??3),seconds=Number(process.argv[4]??180);
 for(let i=0;i<count;i++)console.log(JSON.stringify(match({seed:1982+i,mode,seconds,measure:true})));
}
