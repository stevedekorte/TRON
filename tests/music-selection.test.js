import test from 'node:test';
import assert from 'node:assert/strict';
import {musicCategory,selectMusic,activelyPursued} from '../src/audio/music-selection.js';
test('clip discovery follows filename rules and avoids immediate repetition',()=>{
 const paths=['1 recognized 1.mp3','2 recongized 2.mp3','4 pursued 1.mp3','new PURSUED clip.mp3','doom.mp3'];
 const clips=paths.map(url=>({url,category:musicCategory(url)}));
 assert.equal(selectMusic(clips,'pursued',paths[2],()=>0),paths[3]);
 assert.equal(selectMusic(clips,'recognized',paths[0],()=>0),paths[1]);
 assert.equal(selectMusic(clips,'absent',null),null);
 assert.equal(musicCategory('doom.mp3'),null);
});
test('pursuit music requires a live active chaser, not stale searching memory',()=>{
 const r={recognizers:[{state:'investigate'}],enemyTanks:[]};assert.equal(activelyPursued(r),false);
 r.recognizers[0].state='pursue';assert.equal(activelyPursued(r),true);
 r.crushed=true;assert.equal(activelyPursued(r),false);
});

import {closeRecognizer} from '../src/audio/music-selection.js';
test('gotcha proximity has hysteresis and excludes inactive or destroyed aircraft',()=>{
 const r={x:0,s:0,recognizers:[{x:0,s:50,y:70,state:'pursue'}]};
 assert.equal(musicCategory('12 GOTCHA 2.mp3'),'gotcha');
 assert.equal(closeRecognizer(r,false),true);
 r.recognizers[0].s=95;assert.equal(closeRecognizer(r,false),false);assert.equal(closeRecognizer(r,true),true);
 r.recognizers[0].s=150;assert.equal(closeRecognizer(r,true),false);
 r.recognizers[0].s=20;r.recognizers[0].state='wander';assert.equal(closeRecognizer(r,false),false);
 r.recognizers[0].state='pursue';r.crushed=true;assert.equal(closeRecognizer(r,true),false);
});
