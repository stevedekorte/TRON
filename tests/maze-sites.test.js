import test from 'node:test';
import assert from 'node:assert/strict';
import * as blueprint from '../src/levels/blueprint-maze.js';
import {createMazeWorld} from '../src/levels/maze-world.js';
import {createRun} from '../src/simulation/run.js';
import {collectData,DATA_BEAM} from '../src/simulation/data-beams.js';
import {freePosition,MAZE_INSTANCES} from '../src/levels/maze.js';
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
test('beam transfer requires stopping, cancels on motion or death, and collects once after reversing',()=>{
 const r=createRun(42),b=r.dataBeams[0];r.x=b.x;r.s=b.s;r.speed=10;
 collectData(r);assert.equal(b.transferStartedAt,null);assert.equal(r.dataCollected,0);
 r.speed=0;collectData(r);assert.equal(b.transferStartedAt,0);
 r.time=2;collectData(r);assert.equal(r.dataCollected,0);
 r.speed=1;collectData(r);assert.equal(b.transferStartedAt,null);
 r.speed=0;collectData(r);r.crushed=true;collectData(r);assert.equal(b.transferStartedAt,null);
 r.crushed=false;collectData(r);r.time+=DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds+DATA_BEAM.retractSeconds+.01;
 collectData(r);assert.equal(r.dataCollected,1);collectData(r);assert.equal(r.events.filter(e=>e.type==='dataCollected').length,1);
 assert.equal(createRun(42).dataCollected,0);
});
test('patrol decisions favor new areas and expire old exploration memory',()=>{
 const e={x:0,s:0,patrolVisits:[{x:100,s:0,time:10}]};
 const cells=[{x:100,s:0},{x:-100,s:0}];
 assert.equal(patrolChoices(e,cells,()=>.5,20)[0].x,-100);
 patrolChoices(e,cells,()=>.5,300);assert.ok(e.patrolVisits.every(v=>v.time>=120));
});
