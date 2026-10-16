import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerTeamVoice} from '../../src/audio/multiplayer-team-voice.js';
function setup(team=1,seat=3){
 const sources=[],gains=[],context={currentTime:20,createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true;},start(time){this.when=time;},stop(){this.stopped=true;}};sources.push(source);return source;},createGain(){const gain={gain:{},connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;}};
 const samples={'cycle-blue-leader':{duration:4}},audio=new MultiplayerTeamVoice(context,{},samples);
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
test('other teams, queued spectators, solo and mid-match joins receive no cue',()=>{
 for(const [team,seat,connected] of [[0,3,true],[2,3,true],[3,3,true],[1,null,true],[1,3,false]]){
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
