import test from 'node:test';
import assert from 'node:assert/strict';
import {resetCycleRound} from '../../shared/simulation/light-cycles.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';

test('solo arena breaches heal every breachHealRounds rounds',()=>{
 assert.equal(C.breachHealRounds,2);
 const r={site:{x:0,s:0},seed:1982,round:0,scores:[0,0],time:0,teamCount:2,cyclesPerTeam:1,startWithBreach:false,hideMiddleOpponent:false,breaches:[]};
 const crack=()=>r.breaches.push({axis:'x',sign:1,along:0,id:r.breaches.length,time:r.time});
 resetCycleRound(r);crack();               // round 1 cracks a wall
 resetCycleRound(r);assert.equal(r.breaches.length,1,'round 2 still has the crack');crack();
 resetCycleRound(r);assert.deepEqual(r.breaches,[],'round 3 starts healed');crack();
 resetCycleRound(r);assert.equal(r.breaches.length,1);
 resetCycleRound(r);assert.deepEqual(r.breaches,[]);
});
