import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,cannonTarget} from '../src/simulation/run.js';
import {updateReinforcements} from '../src/simulation/reinforcements.js';
import {updateRecognizers} from '../src/simulation/recognizers.js';
import {debrisVehicleTargets} from '../src/simulation/debris-damage.js';
import {MATERIALIZATION,materializationDuration,materializationPhase} from '../src/game/materialization.js';
function encounter(){const r=createRun(1982);r.recognizers=r.recognizers.slice(0,3);r.enemyTanks=[];r.recognizers.forEach((e,i)=>Object.assign(e,{x:-5000+i*80,s:-5000,y:90,canSee:true,state:'pursue',memory:{x:-5000,s:-4900,vx:0,vs:22,seenAt:0,source:e.id}}));return r;}
function tick(r,seconds){for(let i=0;i<Math.round(seconds*120);i++){r.time+=1/120;updateReinforcements(r,1/120);}}
test('one shared reinforcement each twenty continuous pursuit seconds, regardless of pursuer count',()=>{
 const r=encounter();tick(r,19.99);assert.equal(r.recognizers.length,3);tick(r,.02);assert.equal(r.recognizers.length,4);assert.equal(r.reinforcementsSpawned,1);
 const e=r.recognizers[3];assert.equal(e.state,'materializing');assert.notEqual(e.memory,r.recognizers[0].memory);assert.deepEqual(e.memory,r.recognizers[0].memory);
 assert.equal(e.canSee,false);assert.ok(Math.hypot(e.x-r.recognizers[0].x,e.s-r.recognizers[0].s)<131);
 tick(r,20);assert.equal(r.recognizers.length,5);assert.equal(r.reinforcementsSpawned,2);assert.equal(new Set(r.recognizers.map(e=>e.id)).size,5);
});
test('loss of pursuit resets the clock; destruction and reset stop reinforcements',()=>{
 const r=encounter();tick(r,9);for(const e of r.recognizers){e.canSee=false;e.state='search';}tick(r,1);assert.equal(r.pursuitSeconds,0);
 r.recognizers[0].canSee=true;tick(r,9);assert.equal(r.recognizers.length,3);r.crushed=true;tick(r,20);assert.equal(r.recognizers.length,3);assert.equal(createRun(1982).reinforcementsSpawned,0);
});
test('materializing craft stays inert and intangible, then activates using copied observation',()=>{
 const r=encounter();tick(r,20);const e=r.recognizers.at(-1),start={x:e.x,s:e.s,y:e.y};
 updateRecognizers(r,1/60);assert.deepEqual({x:e.x,s:e.s,y:e.y},start);assert.equal(e.canSee,false);
 assert.ok(!debrisVehicleTargets(r).some(t=>t.key===`enemy:${e.id}`));
 const targetRun={...r,recognizers:[e],x:e.x,s:e.s-80,yaw:0};assert.equal(cannonTarget(targetRun).id,null);
 tick(r,materializationDuration()+.02);assert.equal(e.state,'investigate');assert.ok(debrisVehicleTargets(r).some(t=>t.key===`enemy:${e.id}`));
});
test('reinforcement placement depends on pursuer observations, never live hidden Clu coordinates',()=>{
 const a=encounter(),b=encounter();Object.assign(b,{x:12345,s:-23456});tick(a,20);tick(b,20);assert.deepEqual(a.recognizers.at(-1),b.recognizers.at(-1));
});
test('one opening and sweep finish before a quick whole-body fade and activation',()=>{
 const {openSeconds:o,passSeconds:p,fadeSeconds:f}=MATERIALIZATION;
 assert.equal(materializationPhase(0).height,0);assert.equal(materializationPhase(o/2).scan,0);
 assert.equal(materializationPhase(o).height,1);
 assert.equal(materializationPhase(o+p/2).solid,0);assert.ok(Math.abs(materializationPhase(o+p/2).wire-.5)<1e-9);
 const start=materializationPhase(o+p);assert.ok(Math.abs(start.wire-1)<1e-9);assert.equal(start.solid,0);assert.equal(start.complete,false);
 const middle=materializationPhase(o+p+f/2);assert.equal(middle.scan,1);assert.ok(Math.abs(middle.solid-.5)<1e-9);assert.equal(middle.complete,false);
 const end=materializationPhase(materializationDuration());assert.equal(end.complete,true);assert.equal(end.solid,1);assert.equal(end.opacity,0);
});

test('activation refreshes nearby pursuit knowledge without starting a search beam',async()=>{
 const {searchlightStrength}=await import('../src/simulation/alertness.js');
 const r=encounter();tick(r,20);const e=r.recognizers.at(-1),source=r.recognizers[0];
 source.memory={x:source.x,s:source.s+150,vx:0,vs:22,seenAt:22.7,source:source.id};source.alertUntil=202.7;
 tick(r,materializationDuration()+.02);
 assert.deepEqual(e.memory,source.memory);assert.notEqual(e.memory,source.memory);assert.equal(e.canSee,false);assert.equal(e.spotlight,null);assert.equal(searchlightStrength(e,r.time),0);
});

test('arrival shares freshest ground/air reports in range and confirmed neutralization',async()=>{
 const {inheritNearbyAwareness,SENSORS}=await import('../src/simulation/recognizers.js');
 const r=encounter(),e=r.recognizers[0],peer=r.recognizers[1];r.time=20;
 e.memory=null;peer.memory={x:20,s:30,vx:1,vs:2,seenAt:19,source:peer.id};
 const ground={...peer,id:100,kind:'ground',y:3.8,memory:{...peer.memory,seenAt:19.8,source:100}};r.enemyTanks=[ground];
 inheritNearbyAwareness(e,r);assert.deepEqual(e.memory,ground.memory);assert.equal(e.canSee,false);
 const copy={...e.memory};ground.memory.x=999;assert.deepEqual(e.memory,copy);
 e.memory=null;ground.x=e.x+SENSORS.radioRange+1;peer.y=e.y+SENSORS.radioRange+1;r.recognizers=r.recognizers.slice(0,2);
 inheritNearbyAwareness(e,r);assert.equal(e.memory,null);
 ground.x=e.x;ground.targetGone=true;inheritNearbyAwareness(e,r);assert.equal(e.targetGone,true);assert.equal(e.memory,null);assert.equal(e.alertUntil,0);
});
