import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleOpponentVoice} from '../../src/audio/cycle-opponent-voice.js';
function setup(teams=[0,1,1,1]){
 const sources=[],context={createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;},createGain(){return {gain:{},connect(){},disconnect(){}};}};
 return {audio:new CycleOpponentVoice(context,{},{'cycle-one-opponent-left':{}}),sources,race:{round:1,phase:'racing',playerId:0,cycles:teams.map((team,id)=>({id,team,alive:true}))}};
}
test('solo plays once when living opponents drop to one, not again later in the round',()=>{
 const {audio,sources,race}=setup();audio.update(race,null,true,true);
 race.cycles[1].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,0);
 race.cycles[2].alive=false;assert(audio.update(race,null,true,true));
 race.cycles[2].alive=true;audio.update(race,null,true,true);race.cycles[2].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,1);
 race.round++;for(const b of race.cycles)b.alive=true;audio.update(race,null,true,true);assert(sources[0].stopped);
 race.cycles[1].alive=race.cycles[2].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,2,'next round announces again');
});
test('teammates and escaped cycles are not opponents',()=>{
 const {audio,sources,race}=setup([0,0,1,1,1]);audio.update(race,null,true,true);
 race.cycles[1].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,0,'teammate loss');
 race.cycles[2].escaped=true;audio.update(race,null,true,true);race.cycles[3].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,1);
});
test('silent for dead riders, observers, joins at one opponent, mute and blocked moments',()=>{
 let {audio,sources,race}=setup();race.cycles[1].alive=race.cycles[2].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,0,'joined at one');
 ({audio,sources,race}=setup());audio.update(race,null,true,true);race.cycles[0].alive=false;race.cycles[1].alive=race.cycles[2].alive=false;audio.update(race,null,true,true);assert.equal(sources.length,0,'player dead');
 ({audio,sources,race}=setup());audio.update(race,null,true,true);race.cycles[1].alive=race.cycles[2].alive=false;audio.update(race,null,false,true);audio.update(race,null,true,true);assert.equal(sources.length,0,'muted');
 ({audio,sources,race}=setup());audio.update(race,null,true,true);race.cycles[1].alive=race.cycles[2].alive=false;audio.update(race,null,true,true,true);assert.equal(sources.length,0,'blocked');
});
test('multiplayer follows the assigned seat and needs a connection',()=>{
 const {audio,sources,race}=setup([0,0,1,1]),mp={connected:true,seat:2};audio.update(race,mp,true);
 race.cycles[0].alive=false;assert(audio.update(race,mp,true));
 mp.connected=false;audio.update(race,mp,true);assert(sources[0].stopped);
});
