import test from 'node:test';
import assert from 'node:assert/strict';
import {browserScenario} from '../src/game/browser-scenario.js';
import {blueprintSource} from '../src/levels/blueprint-source.js';
import {createTeleportPads} from '../src/levels/teleporters.js';
import {createRun} from '../src/simulation/run.js';
import {arenaSite} from '../src/levels/arena.js';
test('outer mazes are absent by default and can be restored without moving the labyrinth',()=>{
 const off=browserScenario({search:'?layoutSeed=1982',pathname:'/'}).world;
 const on=browserScenario({search:'?layoutSeed=1982&outerMazes=1',pathname:'/'}).world;
 assert.equal(off.MAZE_INSTANCES.length,1);assert.equal(on.MAZE_INSTANCES.length,5);
 const center=off.MAZE_INSTANCES[0],old=on.MAZE_INSTANCES.find(m=>m.kind==='labyrinth');
 assert.deepEqual([center.x,center.s,center.angle],[old.x,old.s,old.angle]);
 assert.equal(off.WALLS.length,old.walls.length);assert(off.WALLS.every(w=>w.mazeId===0));
 assert(off.OPEN_CELLS.every(p=>p.mazeId===0));assert.equal(off.PATROL_COUNT,6);
 assert.equal(blueprintSource(false).WALLS.length,0);
 const pads=createTeleportPads(off.MAZE_INSTANCES,off.WALL_HEIGHT);assert.equal(pads.length,4);
 for(const p of pads){assert.notEqual(p.destination,p.id);assert(pads.some(d=>d.id===p.destination));}
 assert.equal(createTeleportPads(on.MAZE_INSTANCES).length,20);
 assert.deepEqual(arenaSite(off),arenaSite(on));
 const gap=on.MAZE_INSTANCES[0].bounds.minS-on.SPAWN.s;
 assert(Math.abs((center.bounds.minS-off.SPAWN.s)-gap)<2);
 for(let i=0;i<5;i++)for(const axis of ['x','s'])assert(Math.abs((off.RECOGNIZER_STARTS[i][axis]-off.SPAWN[axis])-(on.RECOGNIZER_STARTS[i][axis]-on.SPAWN[axis]))<1e-8);
 const run=createRun(1982,off);
 assert.equal(run.dataBeams.length,1);assert.equal(run.teleportPads.length,0);
 assert.equal(run.recognizers.filter(e=>e.role==='patrol').length,6);
 assert(run.enemyTanks.length>0);
 assert(off.freePosition(center.beamPosition.x,center.beamPosition.s,2));
});
