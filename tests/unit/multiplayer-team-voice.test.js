import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerTeamVoice,MP_TEAM_VOICE} from '../../src/audio/multiplayer-team-voice.js';
function setup(team=1,seat=3,random=()=>0){
 const sources=[],gains=[],context={currentTime:20,createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true;},start(time){this.when=time;},stop(){this.stopped=true;}};sources.push(source);return source;},createGain(){const gain={gain:{},connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;}};
 const samples=Object.fromEntries(Object.values(MP_TEAM_VOICE.samplesByTeam).map(name=>[name,{name,duration:4}])),audio=new MultiplayerTeamVoice(context,{},samples,random);
 const race={round:1,phase:'countdown',playerId:3,cycles:[{id:3,team}]},mp={connected:true,seat};
 return {audio,race,mp,sources,gains,samples};
}
test('blue assigned players hear one cue scheduled one second after launch per round',()=>{
 const {audio,race,mp,sources,gains}=setup();audio.update(race,mp,true);assert.equal(sources.length,0);
 race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,1);assert.equal(sources[0].when,21);
 for(let i=0;i<30;i++)audio.update({...race},mp,true);assert.equal(sources.length,1);
 sources[0].onended();assert(sources[0].disconnected&&gains[0].disconnected);audio.update(race,mp,true);assert.equal(sources.length,1);
 race.round++;race.phase='countdown';audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,2);
});
test('unknown teams, queued spectators, solo and mid-match joins receive no cue',()=>{
 for(const [team,seat,connected] of [[99,3,true],[1,null,true],[1,3,false]]){
  const {audio,race,mp,sources}=setup(team,seat);mp.connected=connected;audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,0);
 }
 const {audio,race,mp,sources}=setup();race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,0);
 audio.update(race,null,true);assert.equal(sources.length,0);
});
test('mute, exit, disconnect, new round and reassignment cancel scheduled or playing speech',()=>{
 for(const action of ['mute','disconnect','round','seat','result','reset','silence']){
  const {audio,race,mp,sources,gains}=setup();audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);
  if(action==='disconnect')mp.connected=false;
  if(action==='round')race.round++;
  if(action==='seat')mp.seat=null;
  if(action==='result')race.phase='result';
  if(action==='reset')audio.reset();else if(action==='silence')audio.stopPlayback();else audio.update(race,mp,action!=='mute');
  assert(sources[0].stopped&&sources[0].disconnected&&gains[0].disconnected,action);
  audio.update(race,mp,true);assert.equal(sources.length,1,action+' does not replay');
 }
});
test('muted launches and missing buffers are consumed without delayed playback',()=>{
 for(const missing of [false,true]){
  const {audio,race,mp,sources,samples}=setup();audio.update(race,mp,true);if(missing)delete samples['cycle-blue-leader'];
  race.phase='racing';audio.update(race,mp,missing);samples['cycle-blue-leader']={duration:4};audio.update(race,mp,true);assert.equal(sources.length,0);
 }
});

for(const [team,color] of ['gold','blue','red','green'].entries())test(`${color} seat plays only its own radio cue`,()=>{
 const {audio,race,mp,sources,samples,gains}=setup(team);
 race.cycles.push({id:9,team:(team+1)%4});race.playerId=9; // Spectator target must not choose the voice.
 audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);
 assert.equal(sources.length,1);assert.equal(sources[0].buffer,samples[`cycle-${color}-leader`]);assert.equal(sources[0].when,21);assert.equal(gains[0].gain.value,color==='blue'?.85:3.4);
 audio.update(race,mp,true);assert.equal(sources.length,1);
 audio.reset();assert(sources[0].stopped&&sources[0].disconnected);
});

test('first participated launch is guaranteed; later launches roll once at the 20 percent boundary',()=>{
 const rolls=[.2,.199999,.9];let calls=0;
 const {audio,race,mp,sources}=setup(1,3,()=>rolls[calls++]);
 const launch=()=>{race.phase='countdown';audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);for(let i=0;i<10;i++)audio.update(race,mp,true);race.round++;};
 launch();assert.equal(sources.length,1);assert.equal(calls,0);
 launch();assert.equal(sources.length,1);assert.equal(calls,1);
 launch();assert.equal(sources.length,2);assert.equal(calls,2);
 launch();assert.equal(sources.length,2);assert.equal(calls,3);
 audio.reset();launch();assert.equal(sources.length,3);assert.equal(calls,3);
});
test('queued rounds do not consume the first-match guarantee',()=>{
 const {audio,race,mp,sources}=setup(1,null,()=>1);
 audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);
 race.round++;race.phase='countdown';mp.seat=3;audio.update(race,mp,true);
 race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,1);
});
test('muting the first launch consumes that match without a surprise guaranteed replay',()=>{
 const {audio,race,mp,sources}=setup(1,3,()=>1);
 audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,false);
 race.round++;race.phase='countdown';audio.update(race,mp,true);
 race.phase='racing';audio.update(race,mp,true);assert.equal(sources.length,0);
});
