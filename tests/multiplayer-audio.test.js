import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../shared/multiplayer/room.js';
import {MultiplayerClient} from '../src/multiplayer/client.js';
import {CycleVoices} from '../src/audio/cycle-voices.js';

test('network snapshots preserve engine lifetime, launch once, and update live bike references',()=>{
 const room=new CycleRoom();room.join('listener');room.race.remaining=0;room.step();
 const client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{state:room.state(),me:room.state().clients[0],received:performance.now(),rtt:0,pending:[]});
 const run={cycleRace:{round:-1,site:{x:0,s:0}}};
 const sounds=new CycleVoices({currentTime:0},null,{'cycle-drive':true});
 const calls=[];
 sounds.voice=function(name,gain,position,loop=false,bike=null){
  calls.push(name);const v={bike,positionWorld:position,position(p){this.positionWorld=p;},source:{loop,playbackRate:{setTargetAtTime(){}}}};
  this.voices.add(v);return v;
 };
 sounds.stop=function(voice){this.voices.delete(voice);};
 client.apply(run);sounds.update(run.cycleRace,true,null);
 const race=run.cycleRace,bike=race.cycles[client.me.seat],engine=sounds.engines.get(bike.id),count=calls.length,startX=bike.x,startZ=bike.z;
 for(let i=0;i<20;i++){
  room.step();client.state=room.state();client.received=performance.now();client.apply(run);sounds.update(run.cycleRace,true,null);
 }
 assert.equal(run.cycleRace,race);assert.equal(run.cycleRace.cycles[bike.id],bike);
 assert.equal(sounds.engines.get(bike.id),engine);assert.equal(engine.bike,bike);
 assert(bike.x!==startX||bike.z!==startZ);
 assert.equal(calls.length,count,'no repeated launch/engine starts between snapshots');
 room.nextRound();client.state=room.state();client.me=client.state.clients[0];client.apply(run);sounds.update(run.cycleRace,true,null);
 assert.notEqual(run.cycleRace,race);assert.equal(sounds.engines.size,0,'new countdown stops old engines');
});
