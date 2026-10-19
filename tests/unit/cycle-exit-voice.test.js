import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleExitVoice} from '../../src/audio/cycle-exit-voice.js';
function setup(){const sources=[],context={createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;},createGain(){return {gain:{},connect(){},disconnect(){}};}};return {audio:new CycleExitVoice(context,{}, {'cycle-illegal-exit':{}}),sources,race:{round:1,phase:'racing',playerId:0,cycles:[{id:0},{id:1}]}};}
test('solo announces each confirmed exit once, including a second exit after reentry',()=>{
 const {audio,sources,race}=setup();audio.update(race,null,true,true);race.cycles[0].escapeRevision=1;
 assert(audio.update(race,null,true,true));audio.update(race,null,true,true);assert.equal(sources.length,1);
 race.cycles[0].escapeRevision=2;audio.update(race,null,true,true);assert.equal(sources.length,2);assert(sources[0].stopped);
});
test('MP uses assigned seat even on result, never the spectator follow target or a queued client',()=>{
 const {audio,sources,race}=setup(),mp={connected:true,seat:1};audio.update(race,mp,true);
 race.cycles[0].escapeRevision=1;audio.update(race,mp,true);assert.equal(sources.length,0);
 race.cycles[1].escapeRevision=1;race.phase='result';audio.update(race,mp,true);assert.equal(sources.length,1);
 mp.seat=null;audio.update(race,mp,true);assert(sources[0].stopped);
});
test('joining after escape and muted exits do not replay; disconnect and round changes cancel',()=>{
 const {audio,sources,race}=setup(),mp={connected:true,seat:0};race.cycles[0].escapeRevision=1;audio.update(race,mp,true);assert.equal(sources.length,0);
 race.cycles[0].escapeRevision=2;audio.update(race,mp,false);audio.update(race,mp,true);assert.equal(sources.length,0);
 race.cycles[0].escapeRevision=3;audio.update(race,mp,true);mp.connected=false;audio.update(race,mp,true);assert(sources[0].stopped);
 mp.connected=true;audio.update(race,mp,true);race.cycles[0].escapeRevision=4;audio.update(race,mp,true);race.round++;audio.update(race,mp,true);assert(sources[1].stopped);
});
