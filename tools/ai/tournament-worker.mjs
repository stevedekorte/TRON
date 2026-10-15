import {parentPort,workerData} from 'node:worker_threads';
import {match} from './benchmark.mjs';
import {matchFitness,fastWinBonus,offensePoints} from './fitness.mjs';
const {policy,seeds,opponents,seconds,label}=workerData,rows=[];
for(const seed of seeds)for(let seat=0;seat<4;seat++){
 const policies=Array.from({length:4},(_,i)=>opponents[(seed+i)%opponents.length]);policies[seat]=policy;
 const result=match({seed,mode:'bounded',policies,seconds,measure:false,approach:true});
 rows.push({seed,seat,winner:result.winner??null,seconds:result.seconds,matchLimitSeconds:result.matchLimitSeconds,fastWinBonus:fastWinBonus(result,seat),kills:result.wallEliminations[seat],assists:result.trapAssists[seat],confinements:result.confinements[seat],offensePoints:offensePoints(result,seat),offenseEvents:result.offenseEvents,approach:result.approach[seat],approachMs:result.approachMs,fitness:matchFitness(result,seat)});
 parentPort.postMessage({progress:true,label,completed:rows.length,total:seeds.length*4});
}
const wins=rows.filter(r=>r.winner===r.seat).length,draws=rows.filter(r=>r.winner===null).length,matches=rows.length;
const sum=key=>rows.reduce((n,r)=>n+r[key],0);
parentPort.postMessage({result:{wins,draws,losses:matches-wins-draws,matches,winRate:wins/matches,wallEliminations:sum('kills'),trapAssists:sum('assists'),confinements:sum('confinements'),offensePoints:sum('offensePoints'),approach:sum('approach'),approachMs:sum('approachMs'),fastWinBonus:sum('fastWinBonus'),fitness:sum('fitness')/matches,rows}});
