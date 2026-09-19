import test from 'node:test';
import assert from 'node:assert/strict';
import * as blueprint from '../src/levels/blueprint-maze.js';
import {createMazeWorld} from '../src/levels/maze-world.js';
import {createRun,step} from '../src/simulation/run.js';
import {dataRingSweep,damageRingContacts,beginDataTransfer,updateDataWaves,collectData,DATA_BEAM} from '../src/simulation/data-beams.js';
import {freePosition,MAZE_INSTANCES} from '../src/levels/maze.js';
import {CARRIER} from '../src/game/carrier.js';
import {patrolChoices} from '../src/simulation/patrol-decisions.js';
test('rotated sites preserve wall collisions and local clear spaces',()=>{
 const w=createMazeWorld(blueprint,42);
 assert.equal(w.instances.length,4);assert.equal(w.walls.length,blueprint.WALLS.length*4);
 for(const m of w.instances){
  for(const p of blueprint.OPEN_CELLS.slice(0,30)){const world=w.toWorld(p,m);assert.equal(w.freePosition(world.x,world.s,4),true);const local=w.toLocal(world,m);assert.ok(Math.hypot(local.x-p.x,local.s-p.s)<1e-8);}
  const e=blueprint.WALLS[0].edges[0],mid={x:(e.a.x+e.b.x)/2,s:(e.a.s+e.b.s)/2};
  const a={...w.toWorld({x:mid.x+e.nx*5,s:mid.s+e.ns*5},m),y:10},b={...w.toWorld({x:mid.x-e.nx*5,s:mid.s-e.ns*5},m),y:10};
  assert.notEqual(w.wallIntersection(a,b),null);
 }
 for(const a of w.instances)for(const b of w.instances)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.s-b.s)>blueprint.HALF*5);
});
test('each maze has clear data and its own ground and air patrols',()=>{
 const r=createRun(42),again=createRun(42);
 assert.deepEqual(r.dataBeams,again.dataBeams);
 for(const m of MAZE_INSTANCES){
  assert.equal(r.enemyTanks.filter(e=>e.role==='patrol'&&e.mazeId===m.id).length,3);
  assert.equal(r.recognizers.filter(e=>e.role==='patrol'&&e.mazeId===m.id).length,1);
  const b=r.dataBeams[m.id];assert.ok(freePosition(b.x,b.s,DATA_BEAM.wallClearance));
 }
 assert.notDeepEqual(r.dataBeams,createRun(43).dataBeams);
});
test('stationary transfer locks drive, allows aiming, heals, and turns blue only once',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.recognizers=[];r.enemyTanks=[];r.x=b.x;r.s=b.s;r.speed=10;
 beginDataTransfer(r);assert.equal(b.transferStartedAt,null);
 r.speed=0;r.health=.5;const x=r.x,s=r.s;
 for(let i=0;i<600;i++)step(r,{throttle:1,steer:1,turret:1},1/60);
 assert.equal(r.transferActive,true);assert.equal(r.speed,0);assert.equal(r.x,x);assert.equal(r.s,s);assert.notEqual(r.turretYaw,0);assert.ok(r.health>.5);assert.equal(r.dataCollected,0);
 for(let i=0;i<370;i++)step(r,{},1/60);
 assert.equal(r.events.filter(e=>e.type==='dataRingOpen').length,1);assert.equal(r.dataCollected,1);assert.equal(r.health,3);assert.equal(r.transferActive,false);
 beginDataTransfer(r);collectData(r);assert.equal(r.events.filter(e=>e.type==='dataCollected').length,1);
 assert.equal(createRun(42).dataCollected,0);
});
test('transfer cancels on death and a blast hits each unit only when its front reaches it',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.x=b.x;r.s=b.s;r.speed=0;beginDataTransfer(r);r.crushed=true;collectData(r);assert.equal(b.transferStartedAt,null);
 r.crushed=false;b.collectedAt=0;r.enemyTanks=[{id:'test-ground',kind:'ground',x:b.x+100,s:b.s,state:'patrol',health:3}];r.recognizers=[{id:'test-air',x:b.x,s:b.s,y:200,state:'patrol',health:3}];
 r.time=DATA_BEAM.blastSeconds*50/DATA_BEAM.blastRadius;updateDataWaves(r);assert.equal(r.kills,0);
 r.time=DATA_BEAM.blastSeconds*110/DATA_BEAM.blastRadius;updateDataWaves(r);assert.equal(r.enemyTanks[0].state,'destroyed');assert.equal(r.recognizers[0].state,'patrol');
 r.time=DATA_BEAM.blastSeconds*210/DATA_BEAM.blastRadius;updateDataWaves(r);assert.equal(r.recognizers[0].state,'destroyed');updateDataWaves(r);assert.equal(r.kills,2);
});
test('patrol decisions favor new areas and expire old exploration memory',()=>{
 const e={x:0,s:0,patrolVisits:[{x:100,s:0,time:10}]};
 const cells=[{x:100,s:0},{x:-100,s:0}];
 assert.equal(patrolChoices(e,cells,()=>.5,20)[0].x,-100);
 patrolChoices(e,cells,()=>.5,300);assert.ok(e.patrolVisits.every(v=>v.time>=120));
});

test('spherical wave damages carrier once and leaves enemies beyond its reach intact',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.dataBeams=[b];r.time=DATA_BEAM.blastSeconds;b.collectedAt=0;b.x=CARRIER.startX+CARRIER.speed*r.time;b.s=CARRIER.s;
 r.recognizers=[];r.enemyTanks=[{id:'outside',kind:'ground',x:b.x+DATA_BEAM.blastRadius+50,s:b.s,state:'patrol',health:3}];
 updateDataWaves(r);assert.equal(r.carrierHealth,75);assert.equal(r.enemyTanks[0].health,3);updateDataWaves(r);assert.equal(r.carrierHealth,75);
});

test('only lit transfer shafts destroy touching Recognizers, once, at any flight height',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.dataBeams=[b];r.recognizers=r.recognizers.slice(0,1);const e=r.recognizers[0];
 Object.assign(e,{x:b.x+DATA_BEAM.ringRadius,s:b.s,y:400,yaw:0,state:'wander'});
 damageRingContacts(r);assert.notEqual(e.state,'destroyed');
 b.transferStartedAt=0;r.time=1;damageRingContacts(r);assert.equal(e.state,'destroyed');assert.equal(r.kills,1);damageRingContacts(r);assert.equal(r.kills,1);
 e.state='wander';e.health=3;b.collectedAt=r.time;damageRingContacts(r);assert.equal(e.health,3);
 b.collectedAt=null;r.time=2;e.x=b.x+50;damageRingContacts(r);assert.equal(e.health,3);
});

 test('ring engages and retracts twice as fast, retaining its hold and completing with the transfer',()=>{
 const beam={transferStartedAt:0,collectedAt:null};
 assert.equal(dataRingSweep(beam,.75),.5);
 assert.equal(dataRingSweep(beam,1.5),1);
 assert.equal(dataRingSweep(beam,7.5),1);
 assert.equal(dataRingSweep(beam,9.25),.5);
 assert.equal(dataRingSweep(beam,11),0);
 assert.equal(DATA_BEAM.transferSeconds,DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds+DATA_BEAM.retractSeconds);
 assert.equal(DATA_BEAM.blastSeconds,4);
 });

test('off-center CLU entry keeps ring contact damage centered on the data beam',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.dataBeams=[b];r.recognizers=r.recognizers.slice(0,1);
 Object.assign(r,{x:b.x+6,s:b.s,speed:0});beginDataTransfer(r);r.time=DATA_BEAM.buildSeconds;
 const e=r.recognizers[0];Object.assign(e,{x:b.x-DATA_BEAM.ringRadius-10,s:b.s,y:80,yaw:0,state:'wander',health:3});
 damageRingContacts(r);assert.equal(e.state,'destroyed');
});
