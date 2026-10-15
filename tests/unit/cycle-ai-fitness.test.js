import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_FITNESS,fastWinBonus,wallEliminationsByTeam,trapRewardsByTeam,matchFitness,compareFitness} from '../../tools/ai/fitness.mjs';
test('faster wins earn a bounded tunable bonus, never faster losses or timeouts',()=>{
 const result={winner:0,seconds:90,matchLimitSeconds:180};
 assert.equal(matchFitness(result,0),1.25);
 assert.equal(matchFitness({...result,seconds:0},0),1.5);
 assert.equal(matchFitness({...result,seconds:180},0),1);
 assert.equal(matchFitness({...result,seconds:200},0),1);
 assert.equal(matchFitness(result,0,{...AI_FITNESS,fastWinBonusPoints:1}),1.5);
 for(const seconds of [0,90,180]){
  assert.equal(matchFitness({...result,seconds},1),0);
  assert.equal(matchFitness({...result,seconds,winner:null,confinements:[1]},0),.1);
 }
 for(const timing of [{seconds:-1},{seconds:NaN},{seconds:Infinity},{seconds:undefined},{matchLimitSeconds:0},{matchLimitSeconds:undefined},{matchLimitSeconds:Infinity}])assert.equal(fastWinBonus({...result,...timing},0),0);
});
test('offline wall credits count unique enemies including dead owners, not allies or self',()=>{
 const race={teamCount:2,cycles:[{id:0,team:0,alive:false,wallEliminations:[{id:2},{id:2},{id:1},{id:0}]},{id:1,team:0,wallEliminations:[{id:2}]},{id:2,team:1}]};
 assert.deepEqual(wallEliminationsByTeam(race),[1,0]);
 assert.equal(matchFitness({winner:null,wallEliminations:[1,0]},0),.5);
 assert.equal(matchFitness({winner:0,wallEliminations:[1,0]},0),1.5);
});
test('aggression has primary weight but never overrides the runtime gate',()=>{
 const baseline={passesTiming:true,winRate:.5,fitness:.5};
 assert(compareFitness({...baseline,fitness:.6},baseline)<0);
 assert(compareFitness({...baseline,winRate:.4,fitness:.8},baseline)<0);
 assert(compareFitness({...baseline,passesTiming:false,winRate:1,fitness:1.4},baseline)>0);
});

test('multiple trappers share capped per-victim evaluation credit',()=>{
 const race={teamCount:3,cycles:[{id:0,team:0,trapAssists:[{id:2}],trapsCreated:[{id:2}]},{id:1,team:1,trapAssists:[{id:2}],trapsCreated:[{id:2}]},{id:2,team:2}]};
 assert.deepEqual(trapRewardsByTeam(race),{trapAssists:[.5,.5,0],confinements:[.5,.5,0]});
 assert.equal(matchFitness({winner:null,trapAssists:[1],confinements:[1]},0),.44999999999999996);
});
