import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {MultiplayerClient} from '../../src/multiplayer/client.js';
import {CycleVoices} from '../../src/audio/cycle-voices.js';

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

test('countdown beeps track server seconds once, skip gaps, and launch only after countdown',async()=>{
 const {MultiplayerCountdown}=await import('../../src/audio/multiplayer-countdown.js');
 const audio=new MultiplayerCountdown({},null),calls=[];audio.tone=launch=>calls.push(launch?'go':'tick');
 const race={round:1,phase:'countdown',remaining:8};
 for(const remaining of [8,7.99,7.2,7,7.05,6.99,6,4.4]){race.remaining=remaining;audio.update(race,true);}
 assert.deepEqual(calls,['tick','tick','tick','tick'],'no duplicates or catch-up burst');
 race.phase='racing';audio.update(race,true);audio.update(race,true);
 assert.deepEqual(calls,['tick','tick','tick','tick','go']);
 audio.update(null,true);audio.update(race,true);assert.equal(calls.length,5,'joining an active match has no launch cue');
 race.round++;race.phase='countdown';race.remaining=8;audio.update(race,false);audio.update(race,true);
 assert.equal(calls.length,5,'unmute does not replay a consumed beep');
 race.remaining=7;audio.update(race,true);assert.equal(calls.length,6);
 race.phase='racing';audio.update(race,false);audio.update(race,true);assert.equal(calls.length,6);
});

test('countdown synthesis uses short envelopes and disconnects on reset',async()=>{
 const {MultiplayerCountdown,MP_COUNTDOWN_SOUND:C}=await import('../../src/audio/multiplayer-countdown.js');
 const oscillators=[],gains=[];
 const context={currentTime:4,createOscillator(){const o={frequency:{},connect(){},disconnect(){this.disconnected=true;},start(t){this.startTime=t;},stop(t){this.stopTime=t;}};oscillators.push(o);return o;},createGain(){const g={gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){this.disconnected=true;}};gains.push(g);return g;}};
 const audio=new MultiplayerCountdown(context,{});audio.tone(false);audio.tone(true);
 assert.equal(oscillators[0].frequency.value,C.tickHz);assert.equal(oscillators[1].frequency.value,C.launchHz);
 assert.equal(oscillators[0].stopTime,4+C.tickSeconds);assert.equal(oscillators[1].stopTime,4+C.launchSeconds);
 audio.reset();assert.equal(audio.voices.size,0);assert(oscillators.every(o=>o.disconnected));assert(gains.every(g=>g.disconnected));
});

test('network reward snapshots do not retrigger spectator reserve animations',async()=>{
 const {rewardCycleWallOwner}=await import('../../shared/simulation/cycle-reserve-reward.js');
 const room=new CycleRoom();room.join('viewer');
 const owner=room.race.cycles.find(b=>!b.human),victim=room.race.cycles.find(b=>b.team!==owner.team);
 owner.turboCharge=.2;owner.brakeCharge=.4;
 const client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{rtt:0,pending:[]});
 const run={cycleRace:{round:-1,site:{x:0,s:0}}};
 const apply=()=>{client.state=room.state();client.me=client.state.clients[0];client.received=performance.now();client.apply(run);return run.cycleRace.cycles[owner.id];};
 apply();rewardCycleWallOwner(room.race,owner.id,victim);
 const first=apply().reserveReward;
 assert.equal(first.revision,1);
 for(let i=0;i<40;i++)assert.equal(apply().reserveReward,first,'same event keeps its identity across decoded snapshots');
 owner.turboCharge=.2;owner.brakeCharge=.4;rewardCycleWallOwner(room.race,owner.id,victim);
 const next=apply().reserveReward;
 assert.notEqual(next,first,'a real new reward still animates, even with identical values');assert.equal(next.revision,2);
 assert.equal(apply().reserveReward,next);
});

test('spectator HUD reward animation finishes instead of restarting on repeated snapshots',async()=>{
 const {HudPresenter}=await import('../../src/ui/hud-presenter.js');
 const previousDocument=globalThis.document,nodes=new Map();
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{style:{},classList:{toggle(name,value){this[name]=value;}}});return nodes.get(id);}};
 try{
  const hud=Object.create(HudPresenter.prototype),bike={};
  hud.updateReserveReward(bike,0);
  bike.reserveReward={revision:1,turboFrom:.2,brakeFrom:.3,target:1};
  hud.updateReserveReward(bike,100);
  hud.updateReserveReward(bike,400);const fill=nodes.get('turbo-fill').style.transform;
  hud.updateReserveReward(bike,600);assert.notEqual(nodes.get('turbo-fill').style.transform,fill);
  assert.equal(hud.rewardStarted,100);
  hud.updateReserveReward(bike,1300);assert.equal(nodes.get('turbo').classList['reserve-reward'],false);
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
