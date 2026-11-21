import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleSpeedVoice,CYCLE_SPEED_VOICE} from '../../src/audio/cycle-speed-voice.js';
function setup(){
 const sources=[],context={createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;},createGain(){return {gain:{},connect(){},disconnect(){}};}};
 const samples=Object.fromEntries(CYCLE_SPEED_VOICE.milestones.map(m=>[m.sample,{name:m.sample}]));
 return {audio:new CycleSpeedVoice(context,{},samples),sources,race:{round:1,phase:'racing',elapsed:0}};
}
test('announces 200, 300 and 400 percent once each as the arena speeds up',()=>{
 const {audio,sources,race}=setup();audio.update(race,true,true);
 for(const t of [50,99.9])race.elapsed=t,audio.update(race,true,true);assert.equal(sources.length,0);
 race.elapsed=100;assert(audio.update(race,true,true));race.elapsed=150;audio.update(race,true,true);
 race.elapsed=200;audio.update(race,true,true);race.elapsed=300;audio.update(race,true,true);race.elapsed=400;audio.update(race,true,true);
 assert.deepEqual(sources.map(s=>s.buffer.name),['cycle-arena-speed-200','cycle-arena-speed-300','cycle-arena-speed-400']);
});
test('joining, muting or being blocked mid-round does not replay missed milestones later',()=>{
 const {audio,sources,race}=setup();race.elapsed=250;audio.update(race,true,true);
 race.elapsed=260;audio.update(race,true,true);assert.equal(sources.length,0,'joined after 300%');
 race.elapsed=300;audio.update(race,true,false);race.elapsed=301;audio.update(race,true,true);assert.equal(sources.length,0,'muted at 400%');
 race.round++;race.elapsed=0;audio.update(race,true,true);race.elapsed=100;audio.update(race,true,true,true);
 race.elapsed=101;audio.update(race,true,true);assert.equal(sources.length,0,'blocked by exit voice');
});
test('new rounds, inactive arenas and muting stop playback; staging does not announce',()=>{
 const {audio,sources,race}=setup();audio.update(race,true,true);race.elapsed=100;audio.update(race,true,true);
 audio.update(race,true,false);assert(sources[0].stopped);
 race.elapsed=200;race.phase='result';audio.update(race,true,true);assert.equal(sources.length,1);
 race.phase='racing';race.elapsed=300;audio.update(race,true,true);assert.equal(sources.length,2);
 race.round++;race.elapsed=0;audio.update(race,true,true);assert(sources[1].stopped);
 race.elapsed=100;audio.update(race,false,true);race.elapsed=101;audio.update(race,true,true);assert.equal(sources.length,2);
});
