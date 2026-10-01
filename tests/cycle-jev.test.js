import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenario} from '../src/levels/scenario.js';
import {createCycleRace,chooseCycleDirection,resetCycleRound} from '../src/simulation/light-cycles.js';
import {selectCycleParticipant} from '../src/ai/jev-cycles.js';
import {JevClient} from '../src/ai/jev-client.js';
import {jevQuestion} from '../shared/jev-protocol.js';
const {world}=createScenario({layout:'blueprint',centralLabyrinth:true});
function fixture(){
 const race=createCycleRace(world);race.playerId=1;race.phase='racing';
 return {cycleRace:race,playerVehicle:'cycle',time:1,settings:{vehicle:{aiMode:'jev',aiConfidence:.25}}};
}
test('cycle requests rotate across both teams, exclude human and use cycle prompt',()=>{
 const run=fixture(),ids=[];
 for(let i=0;i<5;i++){
  const p=selectCycleParticipant(run);assert(p);ids.push(p.id);
  assert.match(jevQuestion(p.plan.snapshot).questions.maneuver.instructions,/light cycle/);
 }
 assert.equal(new Set(ids).size,5);assert(!ids.includes('cycle-1'));
 assert.equal(selectCycleParticipant(run),null);
});
test('valid goals affect steering but cannot command a blocked cell',()=>{
 const run=fixture(),r=run.cycleRace,b=r.cycles[0];
 Object.assign(b,{x:0,z:0,dir:0});r.occupied.fill(0);r.cycles.slice(1).forEach(b=>b.alive=false);
 const p=selectCycleParticipant(run),option=p.plan.snapshot.options.find(o=>o.goal.x>0);
 assert(p.apply({id:option.id,confidence:.9},p.plan.revision));
 assert.equal(chooseCycleDirection(r,b),1);
 const side=173;r.occupied[86*side+87]=5;
 assert.notEqual(chooseCycleDirection(r,b),1);
});
test('dead, escaped, reset, stale and low-confidence answers are rejected',()=>{
 for(const change of [r=>r.cycles[0].alive=false,r=>r.cycles[0].escaped=true,r=>resetCycleRound(r),r=>r.time+=3,r=>r.arenaPaused=true]){
  const run=fixture(),p=selectCycleParticipant(run);change(run.cycleRace);
  assert.equal(p.apply({id:'m0',confidence:1},p.plan.revision),false);
 }
 const run=fixture(),p=selectCycleParticipant(run);
 assert.equal(p.apply({id:'m0',confidence:.1},p.plan.revision),false);
 assert.equal(p.apply({id:'m99',confidence:1},p.plan.revision),false);
});
test('cycle snapshots omit contacts behind trails and beyond sensor range',()=>{
 const run=fixture(),r=run.cycleRace,b=r.cycles[0];Object.assign(b,{x:0,z:0,dir:0});r.occupied.fill(0);
 Object.assign(r.cycles[1],{x:10,z:0});Object.assign(r.cycles[2],{x:70,z:0});
 r.occupied[86*173+91]=3;
 const p=selectCycleParticipant(run);
 assert(!p.plan.snapshot.visibleCycles.some(b=>b.id===1||b.id===2));
});
test('shared JEV transport applies cycle replies and falls back on service failure',async()=>{
 const run=fixture();let snapshot;
 const client=new JevClient(async(_url,options)=>{snapshot=JSON.parse(options.body);return {ok:true,json:async()=>({id:'m0',confidence:1})};});
 client.update(run,true);await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(snapshot.controller,'cycle');assert(run.cycleRace.cycles[0].jevGoal);assert.equal(client.history[0].accepted,true);
 run.settings.vehicle.aiMode='local';client.update(run,true);assert.equal(run.cycleRace.cycles[0].jevGoal,undefined);client.dispose();
 const fallback=fixture(),failed=new JevClient(async()=>{throw new Error('offline');});
 failed.update(fallback,true);await new Promise(resolve=>setTimeout(resolve,0));
 assert(failed.warning);assert.equal(fallback.cycleRace.cycles[0].jevGoal,undefined);
 assert(Number.isInteger(chooseCycleDirection(fallback.cycleRace,fallback.cycleRace.cycles[0])));failed.dispose();
});
