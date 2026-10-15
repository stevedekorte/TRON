import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {MultiplayerClient} from '../../src/multiplayer/client.js';

test('waiting roster excludes eliminated players retaining seats',()=>{
 const room=new CycleRoom();room.join('seated');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 const seat=room.clients.get('seated').seat;
 room.race.cycles[seat].alive=false;room.step();room.join('visitor');
 const client=Object.create(MultiplayerClient.prototype);
 const update=()=>Object.assign(client,{state:room.state(),me:room.state().clients.find(c=>c.id==='seated'),received:performance.now(),rtt:0,pending:[]});
 const run={cycleRace:{round:-1,site:{x:0,s:0}}};
 update();client.apply(run);
 assert.equal(client.me.seat,seat);
 assert.equal(run.multiplayer.waiting,2);
 assert.equal(run.multiplayer.unseatedWaiting,1);
 room.leave('visitor');update();client.apply(run);
 assert.equal(run.multiplayer.unseatedWaiting,0);
 room.nextRound();update();client.apply(run);
 assert.equal(run.multiplayer.unseatedWaiting,0);
});
