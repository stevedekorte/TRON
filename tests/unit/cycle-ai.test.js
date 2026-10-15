import test from 'node:test';
import assert from 'node:assert/strict';
import {arena} from '../../tools/ai/benchmark.mjs';
import {planCycleAI,cycleAIDebug,resetCycleAI,usesBoundedAI} from '../../shared/simulation/cycle-ai/controller.js';
import {ArenaQueries} from '../../shared/simulation/cycle-ai/geometry.js';
import {AI_LIMITS as L,DEFAULT_POLICY,validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
import {forecastSpeed,nextCycleSpeed} from '../../shared/simulation/cycle-ai/speed.js';
import {evaluateCandidate} from '../../shared/simulation/cycle-ai/evaluate.js';
import {updateCycleRace} from '../../shared/simulation/light-cycles.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
import {selectCycleParticipant} from '../../src/ai/jev-cycles.js';
function fixture(){const r=arena(1,'bounded');r.cycles=r.cycles.slice(0,2);r.trails=[];r.occupied.fill(0);r.crashes=[];
 for(const [i,b] of r.cycles.entries())Object.assign(b,{x:i*20,z:0,previousX:i*20,previousZ:0,dir:0,team:i,continuousArena:true,segment:undefined});return r;}
test('speed forecast matches authoritative step order, including charge exhaustion',()=>{
 for(const pedal of [-1,0,1])for(const charge of [0,.01,1]){
  const b={speedMultiplier:1.6,turboCharge:charge,brakeCharge:charge},out=forecastSpeed(b,pedal,1,{});
  let speed=1.6,distance=0,left=1,reserve=charge;
  while(left>1e-9){const active=pedal&&reserve>1e-9,dt=Math.min(left,1/120,active?reserve*5:Infinity);distance+=speed*C.speedMetersPerSecond*dt;speed=nextCycleSpeed(speed,active?(pedal===1?2.5:.5):1,active&&pedal===1,dt);if(active)reserve=Math.max(0,reserve-dt/5);left-=dt;}
  assert.equal(out.distance,distance);assert.equal(out.speed,speed);
 }
});
test('continuous geometry sees fractional barriers and expired trails correctly',()=>{
 const r=fixture(),q=new ArenaQueries(),b=r.cycles[0];r.trails=[{bikeId:1,x1:-2,z1:-3.2,x2:2,z2:-3.2}];
 q.rebuild(r);assert(q.clearance(b,0)<3.2);assert(q.clearance(b,1)>10);
 r.trails[0].dyingAt=0;r.time=5;q.rebuild(r);assert(q.clearance(b,0)>20);
});
test('index and query overflow are conservative and bounded',()=>{
 const r=fixture(),q=new ArenaQueries();r.trails=Array.from({length:L.maxTrails+1},()=>({bikeId:1,x1:2,z1:0,x2:2,z2:2}));
 q.rebuild(r);assert(q.overflow);assert.equal(q.clearance(r.cycles[0],0),0);
 r.trails=r.trails.slice(0,500);q.rebuild(r);assert.equal(q.clearance(r.cycles[0],1),0);assert(q.tests<=L.segmentTestsPerQuery+1);
});
test('human seats are untouched and cycle JEV is disabled only in bounded arenas',()=>{
 const r=fixture();r.cycles[0].human=true;const commands=planCycleAI(r);assert(!commands.has(0));
 assert.equal(selectCycleParticipant({cycleRace:r}),null);assert(usesBoundedAI(r));r.aiMode='classic';assert(!usesBoundedAI(r));
});
test('seeded decisions reproduce; planner visits at most two bots per tick',()=>{
 const a=arena(923,'bounded'),b=arena(923,'bounded');
 for(let i=0;i<360;i++){updateCycleRace(a,1/120);updateCycleRace(b,1/120);assert(cycleAIDebug(a).plans<=2);assert(cycleAIDebug(a).segmentTests<=L.segmentTestsPerTick+24);}
 assert.deepEqual(a.cycles,b.cycles);assert.deepEqual(a.trails,b.trails);
 resetCycleAI(a);assert.equal(cycleAIDebug(a),null);
});
test('a confirmed wall cancels turbo but emergency turning waits for reaction time',()=>{
 const r=fixture(),b=r.cycles[0];b.z=-83.8;b.boosting=true;b.speedMultiplier=2.5;
 const commands=planCycleAI(r),command=commands.get(0);assert.equal(command.turn,0);assert.equal(b.aiTurbo,false);assert.equal(command.reason,'escape');
 const ready=command.pendingTurn.readyTick;assert(ready>=10);
 for(let tick=1;tick<ready;tick++)assert.equal(planCycleAI(r,tick/120).get(0).turn,0);
 assert.notEqual(planCycleAI(r,ready/120).get(0).turn,0);
});
test('cutoff gets credit only with an arrival lead and an exit; open straights conserve turbo',()=>{
 const r=fixture(),q=new ArenaQueries(),b=r.cycles[0],other=r.cycles[1];
 Object.assign(b,{x:0,z:0,dir:1});Object.assign(other,{x:5,z:14,dir:0});q.rebuild(r);
 const early=evaluateCandidate(q,b,1,0,q.clearance(b,1),1,DEFAULT_POLICY,{},1);
 assert(early.safe);assert(early.cutoff>0);
 other.z=1;q.rebuild(r);const late=evaluateCandidate(q,b,1,0,q.clearance(b,1),1,DEFAULT_POLICY,{},1);assert.equal(late.cutoff,0);
 other.x=60;other.z=60;q.rebuild(r);const empty=evaluateCandidate(q,b,1,1,q.clearance(b,1),1,DEFAULT_POLICY,{},1);assert.equal(empty.safe,false);
});
test('policy validation cannot alter safety or runtime limits',()=>{
 assert.throws(()=>validatePolicy({version:1,cutoff:NaN}));assert.throws(()=>validatePolicy({version:1,reserveFloor:-1}));
 const p=validatePolicy({...DEFAULT_POLICY,segmentTestsPerTick:Infinity});assert.equal(p.segmentTestsPerTick,undefined);assert(Object.isFrozen(p));
});

test('optional neural scorer is finite, bounded and cannot bypass safety',async()=>{
 const {validateNetwork,neuralScore}=await import('../../shared/simulation/cycle-ai/network.js');
 assert.throws(()=>validateNetwork({version:1,weights:[1]}));
 const network=validateNetwork({version:1,weights:Array(545).fill(4)});
 assert.equal(neuralScore(network,new Float32Array(32).fill(1)),.25);
 const r=fixture(),q=new ArenaQueries();q.rebuild(r);
 const policy=validatePolicy({...DEFAULT_POLICY,network});
 const blocked=evaluateCandidate(q,r.cycles[0],0,0,0,1,policy,{},1);assert.equal(blocked.safe,false);
 const zero=validateNetwork({version:1,weights:Array(545).fill(0)});assert.equal(neuralScore(zero,new Float32Array(32).fill(1)),0);
});

test('turbo is selected for a cutoff it can earn and rejected when charge is unavailable',()=>{
 const r=fixture(),q=new ArenaQueries(),[b,other]=r.cycles;Object.assign(b,{x:0,z:0,dir:1});Object.assign(other,{x:4,z:8,dir:0});q.rebuild(r);
 const coast=evaluateCandidate(q,b,1,0,45,1,DEFAULT_POLICY,{},1),turbo=evaluateCandidate(q,b,1,1,45,1,DEFAULT_POLICY,{},1);
 assert.equal(coast.cutoff,0);assert(turbo.cutoff>0&&turbo.safe);assert(turbo.score>coast.score);
 b.turboCharge=0;assert.equal(evaluateCandidate(q,b,1,1,45,1,DEFAULT_POLICY,{},1).safe,false);
});
test('braking buys time before an opponent closes the forward crossing',()=>{
 const r=fixture(),q=new ArenaQueries(),[b,other]=r.cycles;Object.assign(b,{x:0,z:0,dir:1});Object.assign(other,{x:8,z:3,dir:0});q.rebuild(r);
 const coast=evaluateCandidate(q,b,1,0,45,1,DEFAULT_POLICY,{},1),brake=evaluateCandidate(q,b,1,-1,45,1,DEFAULT_POLICY,{},1);
 assert.equal(coast.safe,false);assert.equal(brake.safe,true);assert(brake.distance<8*C.cellMeters);
});
test('sub-tick resource exhaustion cannot bypass the six-tick turn cooldown',()=>{
 const r=fixture(),b=r.cycles[0];b.z=-83.8;b.speedMultiplier=2.5;let commands=planCycleAI(r,1),state=commands.get(0);const at=state.pendingTurn.readyTick/120;state=planCycleAI(r,at).get(0);assert.notEqual(state.turn,0);
 // A second tiny resource slice has the same physical tick; no second turn.
 commands=planCycleAI(r,at+.0001);assert.equal(commands.get(0).turn,0);
});

test('closing a confined enemy lane is worth more than an open crossing',()=>{
 const r=fixture(),q=new ArenaQueries(),[b,other]=r.cycles;Object.assign(b,{x:3,z:0,dir:1});Object.assign(other,{x:5,z:14,dir:0});q.rebuild(r);
 const open=evaluateCandidate(q,b,1,0,q.clearance(b,1),1,DEFAULT_POLICY,{},1);
 r.trails=[{bikeId:1,x1:1,z1:2,x2:1,z2:22},{bikeId:1,x1:9,z1:2,x2:9,z2:22}];q.rebuild(r);
 const boxed=evaluateCandidate(q,b,1,0,q.clearance(b,1),1,DEFAULT_POLICY,{},1);
 assert(boxed.safe);assert(boxed.cutoff>open.cutoff);
});

test('solo arena and MP authority use the playtested evolved policy by default',async()=>{
 const {CycleRoom}=await import('../../shared/multiplayer/room.js');
 const solo=arena(1982,'bounded');planCycleAI(solo);
 const room=new CycleRoom();room.join('human');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();room.step();
 for(const race of [solo,room.race]){const bots=cycleAIDebug(race).bots;assert(bots.length);assert(bots.every(b=>b.policyId===DEFAULT_POLICY.id));}
 assert.equal(DEFAULT_POLICY.id,'approach-340000-0-0');
});

test('fewer than half of seeded turn reactions fit within one bike length at brake, cruise and turbo speeds',async()=>{
 const {sampleTurnReactionSeconds,AI_TURN_REACTION}=await import('../../shared/simulation/cycle-ai/reaction.js');
 for(const speedMultiplier of [.5,1,2.5]){
  let seed=1982,quick=0;const samples=new Set(),lengthSeconds=C.lengthMeters/(C.speedMetersPerSecond*speedMultiplier);
  for(let i=0;i<10000;i++){
   const delay=sampleTurnReactionSeconds({speedMultiplier},()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
   assert(delay>=AI_TURN_REACTION.minimumSeconds);samples.add(delay);
   if(Math.ceil(delay*L.tickHz)/L.tickHz<lengthSeconds)quick++;
  }
  assert(quick<5000,`${speedMultiplier}: ${quick/100}% fast reactions`);
  assert(samples.size>100,'reaction time varies rather than using a fixed cooldown');
 }
});

test('charged turbo can set up an overtake before an immediate cutoff exists',()=>{
 const r=fixture(),q=new ArenaQueries(),[b,other]=r.cycles;
 Object.assign(b,{x:0,z:0,dir:0,turboCharge:1});Object.assign(other,{x:3,z:-6,dir:0});q.rebuild(r);
 const coast=evaluateCandidate(q,b,0,0,45,1,DEFAULT_POLICY,{},1),turbo=evaluateCandidate(q,b,0,1,45,1,DEFAULT_POLICY,{},1);
 assert.equal(turbo.cutoff,0);assert(turbo.safe&&turbo.overtake>0);assert.equal(turbo.reason,'overtake');assert(turbo.score>coast.score);
 b.turboCharge=0;assert(!evaluateCandidate(q,b,0,1,45,1,DEFAULT_POLICY,{},1).safe,'cannot spend empty turbo');
 b.turboCharge=DEFAULT_POLICY.reserveFloor/2;assert(!evaluateCandidate(q,b,0,1,45,1,DEFAULT_POLICY,{},1).safe,'preserve reserve floor');
 b.turboCharge=1;other.x=30;q.rebuild(r);assert(!evaluateCandidate(q,b,0,1,45,1,DEFAULT_POLICY,{},1).safe,'distant parallel traffic is not an overtake');
 other.x=3;other.speedMultiplier=C.turboSpeedMultiplier;q.rebuild(r);assert(!evaluateCandidate(q,b,0,1,45,1,DEFAULT_POLICY,{},1).safe,'do not waste charge when no ground can be gained');
});
test('empty brake charge is neither a tactical candidate nor an emergency command',()=>{
 const r=fixture(),q=new ArenaQueries(),b=r.cycles[0];b.brakeCharge=0;q.rebuild(r);
 assert(!evaluateCandidate(q,b,0,-1,45,1,DEFAULT_POLICY,{},1).safe);
 b.z=-83.8;b.speedMultiplier=2.5;planCycleAI(r);assert.equal(b.aiBrake,false);
});
