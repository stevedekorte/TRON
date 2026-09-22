import test from 'node:test';
import assert from 'node:assert/strict';
import {BeamCamera} from '../src/rendering/beam-camera.js';
const run=()=>({time:0,transferActive:true,dataBeams:[{id:'a',transferStartedAt:0,collectedAt:null}]});
test('beam camera rises and returns at half speed, orbit does not move the weapon',()=>{
 const camera=new BeamCamera(),r=run(),opts={yaw:0};
 assert.equal(camera.update(r,opts).blend,0);
 r.time=2.4;assert.equal(camera.update(r,opts).blend,1);
 r.time=5;const frozen=camera.update(r,opts);assert.equal(frozen.yaw,-3);assert.deepEqual(camera.update(r,opts),frozen);
 r.time=9.1;assert.equal(camera.update(r,opts).blend,1);
 r.time=10.3;assert(Math.abs(camera.update(r,opts).blend-.5)<1e-10);
 r.time=11.5;assert.deepEqual(camera.update(r,opts),{active:false,phase:'complete',blend:0,yaw:0});
 assert.equal(camera.update(r,opts),null);assert.equal(r.turretYaw,undefined);
});
test('manual cancellation, reduced motion, reset and interrupted transfers',()=>{
 const camera=new BeamCamera(),r=run(),opts={yaw:0};
 camera.update(r,opts);camera.cancel();assert.equal(camera.update(r,opts),null);
 camera.reset();assert(camera.update(r,opts));r.transferActive=false;assert.equal(camera.update(r,opts),null);
 camera.reset();r.transferActive=true;assert.equal(camera.update(r,{...opts,reducedMotion:true}),null);
 r.dataBeams[0].transferStartedAt=1;r.time=1;assert(camera.update(r,opts));
 r.crushed=true;assert.equal(camera.update(r,opts),null);
});
