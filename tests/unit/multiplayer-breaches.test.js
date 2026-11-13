import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {projectState} from '../../shared/multiplayer/snapshots.js';
import {advanceContinuousCycles} from '../../shared/simulation/cycle-continuous.js';
import {ARENA_WALL as W} from '../../shared/simulation/config/arena-breaches.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';

test('MP arena walls are solid: impacts derez without a breach or escape',()=>{
 const room=new CycleRoom();room.join('human');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 const r=room.race,b=r.cycles[room.clients.get('human').seat];
 assert.equal(r.closedArena,true);
 r.trails=[];
 Object.assign(b,{x:0,z:-(W.innerMeters-W.cycleRadiusMeters-0.1)/C.cellMeters,dir:0,travelRate:C.speedMetersPerSecond/C.cellMeters,continuousArena:true,trailStopped:true});
 advanceContinuousCycles(r,[b],1/120);
 assert.equal(b.alive,false);assert.deepEqual(r.breaches,[]);assert(!r.crashes.at(-1).silent);assert(!b.escaped);
 assert.deepEqual(projectState(room.state()).race.breaches,[]);
 // A revived cycle still cannot pass where an opening would have been.
 b.alive=true;r.crashes=[];
 b.z=-(W.innerMeters-W.cycleRadiusMeters-0.1)/C.cellMeters;
 advanceContinuousCycles(r,[b],1/120);
 assert.equal(b.alive,false);assert.deepEqual(r.breaches,[]);
});
