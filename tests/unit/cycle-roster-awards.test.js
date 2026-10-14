import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardCycleWallOwner} from '../../shared/simulation/cycle-reserve-reward.js';
import {resetCycleRound} from '../../shared/simulation/light-cycles.js';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {projectState,compactSnapshot,decodeSnapshot} from '../../shared/multiplayer/snapshots.js';

test('enemy trail eliminations retain victim colors once, including after owner death',()=>{
 const owner={id:0,team:0,alive:true,turboCharge:.5,brakeCharge:.5},enemy={id:1,team:1},ally={id:2,team:0},second={id:3,team:2};
 const race={cycles:[owner,enemy,ally,second]};
 rewardCycleWallOwner(race,0,enemy);rewardCycleWallOwner(race,0,enemy);
 rewardCycleWallOwner(race,0,ally);rewardCycleWallOwner(race,0,owner);
 assert.deepEqual(owner.wallEliminations,[{id:1,team:1}]);
 owner.alive=false;const reserve=owner.reserveReward;rewardCycleWallOwner(race,0,second);
 assert.deepEqual(owner.wallEliminations,[{id:1,team:1},{id:3,team:2}]);assert.equal(owner.reserveReward,reserve);
});

test('awards survive full/delta multiplayer snapshots and reset with the round',()=>{
 const room=new CycleRoom(),owner=room.race.cycles[0],enemy=room.race.cycles.find(b=>b.team!==owner.team);
 const before=projectState(room.state());rewardCycleWallOwner(room.race,owner.id,enemy);
 const next=projectState(room.state()),decoded=decodeSnapshot(compactSnapshot(next,before),before);
 assert.deepEqual(decoded.race.cycles[0].wallEliminations,[{id:enemy.id,team:enemy.team}]);
 assert.deepEqual(decodeSnapshot(compactSnapshot(next,null),null).race.cycles[0].wallEliminations,decoded.race.cycles[0].wallEliminations);
 resetCycleRound(room.race);const reset=projectState(room.state());assert.equal(reset.race.cycles[0].wallEliminations,undefined);
 assert.equal(decodeSnapshot(compactSnapshot(reset,next),next).race.cycles[0].wallEliminations,undefined);
});
