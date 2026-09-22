import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAutoplayInput as merge} from '../src/simulation/autoplay-input.js';
const pilot={throttle:1,steer:.4,turret:.7,fire:false,firePressed:false};
const manual={throttle:0,steer:0,turret:0,aimPitch:0,fire:false,firePressed:false};
test('manual fire preserves pilot driving and turret',()=>{
 const result=merge(pilot,{...manual,fire:true,firePressed:true},new Set(['Space']),{});
 assert.equal(result.throttle,1);assert.equal(result.steer,.4);assert.equal(result.turret,.7);assert(result.fire&&result.firePressed);
});
test('held keys override only their channels, release restores pilot',()=>{
 let result=merge(pilot,{...manual,throttle:-1,turret:-1},new Set(['KeyS','KeyJ']),{});
 assert.equal(result.throttle,-1);assert.equal(result.turret,-1);assert.equal(result.steer,.4);
 result=merge(pilot,manual,new Set(),{});assert.equal(result.throttle,1);assert.equal(result.turret,.7);
 assert.equal(merge(pilot,manual,new Set(['KeyA','KeyD']),{}).steer,0);
});
test('mouse aim and centering suppress automatic turret input, cruise retains throttle',()=>{
 assert.equal(merge(pilot,{...manual,mouseTarget:{yaw:1}},new Set(),{}).turret,0);
 assert.equal(merge(pilot,manual,new Set(),{turretCentering:true}).turret,0);
 assert.equal(merge(pilot,{...manual,throttle:1},new Set(),{cruiseThrottle:true}).throttle,1);
});
