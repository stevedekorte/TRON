import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {projectState,compactSnapshot,decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
import {advanceContinuousCycles} from '../../shared/simulation/cycle-continuous.js';
import {ARENA_WALL as W} from '../../shared/simulation/config/arena-breaches.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';

test('MP wall impacts breach, exits silently eliminate and the next round heals walls',()=>{
 const room=new CycleRoom();room.join('human');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 const r=room.race,b=r.cycles[room.clients.get('human').seat];
 const before=projectState(room.state());
 r.trails=[];
 Object.assign(b,{x:0,z:-(W.innerMeters-W.cycleRadiusMeters-0.1)/C.cellMeters,dir:0,travelRate:C.speedMetersPerSecond/C.cellMeters,continuousArena:true,trailStopped:true});
 advanceContinuousCycles(r,[b],1/120);
 assert.equal(b.alive,false);assert.equal(r.breaches.length,1);assert(!r.crashes.at(-1).silent);
 const breached=projectState(room.state());
 assert.deepEqual(decodeSnapshot(compactSnapshot(breached,before),before).race.breaches,r.breaches);
 // Travel through the opening, then cross the outer edge.
 b.alive=true;r.crashes=[];
 b.z=-(W.innerMeters+1)/C.cellMeters;
 advanceContinuousCycles(r,[b],.01);
 assert(b.alive,'the opening is traversable');
 b.z=-(W.outerMeters+W.cycleRadiusMeters-.1)/C.cellMeters;
 advanceContinuousCycles(r,[b],1/120);
 assert.equal(b.alive,false);assert(!b.escaped,'no road-mode cycle survives');
 assert.equal(r.crashes.length,1);assert.equal(r.crashes[0].silent,true);
 assert.equal(projectState(room.state()).race.crashes[0].silent,true);
 assert.equal(b.escapeRevision,1);assert.equal(projectState(room.state()).race.cycles[b.id].escapeRevision,1);
 room.step();assert(room.queue.includes('human'));
 room.nextRound();assert.deepEqual(r.breaches,[]);assert.deepEqual(r.crashes,[]);
 assert(r.cycles.every(c=>c.alive));
});
