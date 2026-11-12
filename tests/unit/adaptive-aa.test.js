import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveAA,aaLevels,supportedSamples} from '../../src/rendering/adaptive-aa.js';
const feed=(aa,seconds,fps,active=true)=>{let changes=0;for(let i=0;i<seconds*fps;i++)changes+=Number(aa.sample(1/fps,active));return changes;};
test('uses only sample counts supported by both HDR color and depth/stencil',()=>{
 const gl={RENDERBUFFER:1,RGBA16F:2,DEPTH24_STENCIL8:3,SAMPLES:4,getInternalformatParameter:(_,format)=>format===2?[8,4,2]:[4,2]};
 assert.deepEqual(supportedSamples(gl),[0,2,4]);
 assert(aaLevels([0,4]).every(l=>[0,4].includes(l.samples)));
 assert(aaLevels([0]).every(l=>l.samples===0));
});
test('isolated stalls and inactive frames do not lower quality',()=>{
 const aa=new AdaptiveAA([0,2,4]),initial=aa.index;
 feed(aa,4,60);aa.sample(.1);feed(aa,3,60);assert.equal(aa.index,initial);
 aa.sample(2);feed(aa,60,20,false);assert.equal(aa.index,initial);
});
test('upgrades slowly, backs off after sustained misses and retries only after cooldown',()=>{
 const aa=new AdaptiveAA([0,2,4]),initial=aa.index;
 assert.equal(feed(aa,20,60),0);feed(aa,9,60);assert.equal(aa.index,initial+1);
 feed(aa,5,40);assert.equal(aa.index,initial);assert.equal(aa.ceiling,initial);
 assert.equal(feed(aa,40,60),0);assert.equal(aa.index,initial);
 feed(aa,25,60);assert.equal(aa.index,initial+1);
});
test('sustained overload reaches the half-resolution floor and recovers with sustained headroom',()=>{
 const aa=new AdaptiveAA([0,2,4]);feed(aa,90,25);assert.equal(aa.index,0);
 assert.deepEqual(aa.quality,{ratio:.5,samples:0,pov:false});feed(aa,400,60);assert(aa.quality.ratio>=1);
});
test('degrades supersampling and 8x MSAA, then POV-Ray, then light MSAA, then resolution',()=>{
 const levels=aaLevels([0,2,4,8]),pov=levels.findIndex(l=>l.pov);
 assert.deepEqual(levels.at(-1),{ratio:2,samples:8,pov:true});
 // Every POV level is at native resolution or above; every level below keeps POV off.
 assert(levels.slice(pov).every(l=>l.pov&&l.ratio>=1));
 assert.deepEqual(levels[pov-1],{ratio:1,samples:4,pov:false});
 // Light MSAA is gone before any sub-native resolution is used.
 assert(levels.filter(l=>l.ratio<1).every(l=>l.samples===0));
 // Above POV, heavy MSAA goes before the last supersampling step.
 assert.deepEqual(levels.slice(pov).map(l=>[l.ratio,l.samples]),[[1,4],[1.25,4],[1.5,4],[1.5,8],[2,8]]);
});
test('the POV step costs a window only while POV-Ray cycles are in use',()=>{
 const steps=relevant=>{const aa=new AdaptiveAA([0,2,4]);aa.setPovRelevant(relevant);const seen=[];
  while(aa.index>0){const before=aa.index;feed(aa,3,25);if(aa.index!==before)seen.push({...aa.quality});}
  return seen;};
 const withPov=steps(true),without=steps(false);
 assert(withPov.some(l=>!l.pov&&l.ratio===1&&l.samples===4),'POV off at 1x/4x is a distinct step');
 assert.equal(withPov.length,without.length+1);
});
test('selecting POV-Ray raises quality to the lowest POV level, never lowers it',()=>{
 const aa=new AdaptiveAA([0,2,4]);aa.setPovRelevant(true);const first=aa.levels.findIndex(l=>l.pov);
 feed(aa,90,25);assert.equal(aa.index,0);aa.raiseTo(first);assert.equal(aa.index,first);assert(aa.quality.pov);
 const high=new AdaptiveAA([0,2,4]),initial=high.index;high.raiseTo(first);assert.equal(high.index,initial);
});
test('unstable frame pacing prevents speculative upgrades',()=>{
 const aa=new AdaptiveAA([0,2,4]);const initial=aa.index;
 for(let i=0;i<60;i++){feed(aa,1,60);feed(aa,1,50);}
 assert.equal(aa.index,initial);
});

test('initial quality restores aircraft supersampling without requiring 8x MSAA',()=>{
 for(const samples of [[0],[0,4],[0,2,4,8]]){const aa=new AdaptiveAA(samples);assert.equal(aa.quality.ratio,1.5);assert(aa.quality.samples<=4);}
});
