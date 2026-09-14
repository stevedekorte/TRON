import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,cannonPose,updateWeapons} from '../src/simulation/run.js';
import {angleDelta,GUNNER,gunnerAimScale} from '../src/game/config.js';
function fixture(){const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,gunner:true});r.recognizers=[];r.enemyTanks=[];return r;}
test('gunner aim holds world heading through hull turns; manual aim stays independent',()=>{const r=fixture();r.turretYaw=.7;for(let i=0;i<300;i++)step(r,{steer:1},1/60);assert.ok(Math.abs(angleDelta(.7,r.yaw+r.turretYaw))<1e-8);const old=r.yaw+r.turretYaw;step(r,{turret:1,steer:1,aimPitch:1},1/60);assert.ok(angleDelta(old,r.yaw+r.turretYaw)<0);assert.ok(r.aimPitch>0);});
test('manual gunner rounds follow sight elevation without target assistance',()=>{const r=fixture();r.aimPitch=.6;const p=cannonPose(r);updateWeapons(r,{fire:true},0);const shot=r.projectiles[0];assert.ok(Math.abs(Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vs))-.6)<1e-8);assert.equal(shot.x,p.x);for(let i=0;i<600;i++)step(r,{aimPitch:1},1/60);assert.equal(r.aimPitch,GUNNER.maxPitch);for(let i=0;i<600;i++)step(r,{aimPitch:-1},1/60);assert.equal(r.aimPitch,GUNNER.minPitch);});

test('zoom scales horizontal and vertical aiming to preserve screen-space sensitivity',()=>{const samples=[0,1,2].map(gunnerZoom=>{const r=fixture();r.gunnerZoom=gunnerZoom;step(r,{turret:1,aimPitch:1},1/60);return r;});for(let z=1;z<3;z++){assert.ok(Math.abs(samples[z].turretYaw/samples[0].turretYaw-gunnerAimScale(z))<1e-8);assert.ok(Math.abs(samples[z].aimPitch/samples[0].aimPitch-gunnerAimScale(z))<1e-8);assert.ok(Math.abs(samples[z].turretYaw)<Math.abs(samples[z-1].turretYaw));}});
