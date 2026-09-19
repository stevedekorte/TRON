import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../src/simulation/run.js';
import {applyDebrisImpacts,debrisVehicleTargets,impactDamage,DEBRIS_DAMAGE} from '../src/simulation/debris-damage.js';
const hit=(target,damage)=>({target,energy:DEBRIS_DAMAGE.thresholdJoules+DEBRIS_DAMAGE.joulesPerHealth*damage,point:{x:0,y:2,z:0}});
test('threshold and energy scaling',()=>{assert.equal(impactDamage(4999),0);assert.equal(impactDamage(55000),1);assert.equal(impactDamage(105000),2);});
test('debris can hurt or kill each vehicle through normal game events',()=>{
 const run=createRun(42),enemy=run.enemyTanks[0],rec=run.recognizers[0];
 applyDebrisImpacts(run,[hit('clu',.5),hit(`enemy:${enemy.id}`,1),hit('carrier',10)]);
 assert.equal(run.health,2.5);assert.equal(enemy.health,2);assert.equal(run.carrierHealth,90);assert.equal(run.impact,1);
 applyDebrisImpacts(run,[hit('clu',4),hit(`enemy:${enemy.id}`,4),hit(`enemy:${rec.id}`,4)]);
 assert.equal(run.crushed,true);assert.equal(run.speed,0);assert.equal(enemy.state,'destroyed');assert.equal(rec.state,'destroyed');assert.equal(run.kills,2);
 const destroyed=run.events.filter(e=>e.type==='destroyed');assert.equal(destroyed.length,3);
 applyDebrisImpacts(run,[hit(`enemy:${enemy.id}`,4)]);assert.equal(run.kills,2);
 const keys=debrisVehicleTargets(run).map(t=>t.key);assert.ok(!keys.includes('clu'));assert.ok(!keys.includes(`enemy:${rec.id}`));
});
