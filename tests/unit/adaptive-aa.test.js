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
test('upgrades slowly, backs off after sustained misses and never retries rejected levels',()=>{
 const aa=new AdaptiveAA([0,2,4]),initial=aa.index;
 assert.equal(feed(aa,20,60),0);feed(aa,9,60);assert.equal(aa.index,initial+1);
 feed(aa,5,40);assert.equal(aa.index,initial);assert.equal(aa.ceiling,initial);
 assert.equal(feed(aa,180,60),0);assert.equal(aa.index,initial);
});
test('sustained overload reaches a bounded floor and stays there',()=>{
 const aa=new AdaptiveAA([0,2,4]);feed(aa,45,25);assert.equal(aa.index,0);
 assert.equal(feed(aa,180,60),0);assert.equal(aa.index,0);
});
test('unstable frame pacing prevents speculative upgrades',()=>{
 const aa=new AdaptiveAA([0,2,4]);const initial=aa.index;
 for(let i=0;i<60;i++){feed(aa,1,60);feed(aa,1,50);}
 assert.equal(aa.index,initial);
});
