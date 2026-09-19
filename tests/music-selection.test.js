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

import {quietMazeExploration} from '../src/audio/music-selection.js';
import {MAZE_INSTANCES,MAZE_LENGTH} from '../src/levels/maze.js';
test('quiet exploration recognizes all rotated maze sites and excludes pursuit or death',()=>{
 const r={recognizers:[],enemyTanks:[]};
 for(const m of MAZE_INSTANCES){Object.assign(r,{x:m.x,s:m.s});assert.equal(quietMazeExploration(r),true);}
 r.x=MAZE_LENGTH*100;assert.equal(quietMazeExploration(r),false);
 Object.assign(r,{x:0,s:0});r.enemyTanks=[{state:'pursue'}];assert.equal(quietMazeExploration(r),false);
 r.enemyTanks=[];r.crushed=true;assert.equal(quietMazeExploration(r),false);
});

import {mazeMusicCue,MAZE_MUSIC,beamBaseVisible} from '../src/audio/music-selection.js';
import {PerspectiveCamera} from 'three';
test('maze cues progress from general exploration to hidden approach, sighting and entry',()=>{
 const r={x:0,s:0,recognizers:[],enemyTanks:[],dataBeams:[{id:0,x:MAZE_MUSIC.nearDistance+1,s:0,collectedAt:null}]};
 assert.equal(mazeMusicCue(r,()=>true).category,'exploration');r.dataBeams[0].x=50;
 assert.equal(mazeMusicCue(r,()=>false).category,'approaching');assert.equal(mazeMusicCue(r,()=>true).category,'spotted');
 r.dataBeams[0].x=2;assert.equal(mazeMusicCue(r,()=>false).category,'enter');
 r.dataBeams[0].collectedAt=0;assert.equal(mazeMusicCue(r,()=>true).category,'exploration');
 r.enemyTanks=[{state:'pursue'}];assert.equal(mazeMusicCue(r,()=>true),null);
});
test('beam visibility requires the base inside the camera view',()=>{
 const camera=new PerspectiveCamera(60,1,.1,1000);camera.position.set(10000,5,10000);camera.lookAt(10000,.25,9990);camera.updateMatrixWorld();
 assert.equal(beamBaseVisible({x:10000,s:-9990},camera),true);
 assert.equal(beamBaseVisible({x:10000,s:-10010},camera),false);
});
