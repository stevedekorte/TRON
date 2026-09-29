import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,updateWeapons,cannonTarget,cannonPose} from '../src/simulation/run.js';
import {CLU_WEAPON} from '../src/game/config.js';
const dt=1/60;
function fixture(){const r=createRun();Object.assign(r,{x:-5000,s:-5000});r.recognizers=[];r.enemyTanks=[];return r;}
function idle(r,seconds){for(let i=0;i<Math.round(seconds/dt);i++)updateWeapons(r,{},dt);}
function press(r){updateWeapons(r,{fire:true,firePressed:true},dt);}
test('Clu starts with all three stored shots charged',()=>{
 assert.equal(fixture().extraShots,3);
});
test('idle recharge adds exactly one stored shot at 5, 10 and 15 seconds',()=>{
 const r=fixture();r.extraShots=0;assert.equal(CLU_WEAPON.reserveRecharge,5);
 for(let count=1;count<=3;count++){
  idle(r,5-dt);assert.equal(r.extraShots,count-1);
  idle(r,dt);assert.equal(r.extraShots,count);
 }
 idle(r,60);assert.equal(r.extraShots,3);assert.equal(r.shotRest,0);
});
test('three banked extras permit four rapid presses, then normal recharge resumes',()=>{
 const r=fixture();idle(r,30);
 for(let i=0;i<4;i++)press(r);
 assert.equal(r.shots,4);assert.equal(r.extraShots,0);
 press(r);assert.equal(r.shots,4);
 idle(r,CLU_WEAPON.recharge);press(r);assert.equal(r.shots,5);
 idle(r,4);assert.equal(r.extraShots,0);idle(r,1);assert.equal(r.extraShots,1);
});
test('holding fire preserves extras and normal cadence; a fresh press bypasses cooldown',()=>{
 const r=fixture();idle(r,30);press(r);
 for(let i=0;i<10;i++)updateWeapons(r,{fire:true,firePressed:false},dt);
 assert.equal(r.shots,1);assert.equal(r.extraShots,3);
 press(r);assert.equal(r.shots,2);assert.equal(r.extraShots,2);
 for(let i=0;i<120;i++)updateWeapons(r,{fire:true,firePressed:false},dt);
 assert.equal(r.extraShots,2);assert.equal(r.shots,3);
});
test('firing restarts only the next-shot timer; paused or destroyed tanks do not recharge',()=>{
 const r=fixture();r.extraShots=0;idle(r,9);assert.equal(r.extraShots,1);
 press(r);idle(r,4);assert.equal(r.extraShots,1);
 const rest=r.shotRest;updateWeapons(r,{},0);assert.equal(r.shotRest,rest);
 idle(r,1);assert.equal(r.extraShots,2);
 press(r);press(r);assert.equal(r.extraShots,1);
 idle(r,5);assert.equal(r.extraShots,2);
 r.crushed=true;const shots=r.shots;idle(r,30);press(r);
 assert.equal(r.extraShots,2);assert.equal(r.shots,shots);
});

test('outside gunner, level shots vary horizontally but never vertically and keep full speed',()=>{
 const r=fixture();r.seed=42;const directions=[];
 for(let i=0;i<40;i++){
  r.cooldown=0;r.projectiles=[];updateWeapons(r,{fire:true},0);
  const p=r.projectiles[0];directions.push(p.vx);
  assert.equal(p.vy,0);
  assert.ok(Math.abs(Math.hypot(p.vx,p.vs,p.vy)-CLU_WEAPON.speed)<1e-10);
  assert.ok(Math.abs(-Math.atan2(p.vx,p.vs)-r.yaw)<=CLU_WEAPON.yawSpread+1e-10);
 }
 assert.ok(new Set(directions).size>30);
});
test('gunner fire remains exact and does not use spread',()=>{
 const r=fixture();r.gunner=true;r.aimPitch=.2;
 for(let i=0;i<8;i++){
  r.cooldown=0;r.projectiles=[];updateWeapons(r,{fire:true},0);
  const p=r.projectiles[0];
  assert.ok(Math.abs(p.vy-CLU_WEAPON.speed*Math.sin(.2))<1e-10);
  assert.ok(Math.abs(p.vx+Math.sin(r.yaw)*Math.cos(.2)*CLU_WEAPON.speed)<1e-10);
 }
});
test('assisted spread is reproducible and cannot send rounds into the floor',()=>{
 function shot(seed,height){
  const r=fixture();r.seed=seed;r.yaw=0;
  r.recognizers=[{id:0,x:r.x,s:r.s+100,y:height-1,vx:0,vs:0,vy:0,state:'patrol',hit:0}];
  updateWeapons(r,{fire:true},0);return r.projectiles[0];
 }
 assert.deepEqual(shot(42,40),shot(42,40));
 for(let seed=0;seed<100;seed++)for(const y of [1,2.3,40]){
  const p=shot(seed,y);assert.ok(p.vy>=0);
  assert.ok(p.y+p.vy*CLU_WEAPON.lifetime>0);
 }
});
test('locked auto aim scatters shots beyond the old cone while retaining bounded lead',()=>{
 const r=fixture();Object.assign(r,{seed:42,yaw:0});
 r.recognizers=[{id:0,x:r.x,s:r.s+500,y:70,vx:0,vs:0,vy:0,state:'patrol',hit:0}];
 const target=cannonTarget(r),pose=cannonPose(r);assert(target.lock);
 const yaw=-Math.atan2(target.x-pose.x,target.s-pose.s),pitch=Math.atan2(target.y-pose.y,Math.hypot(target.x-pose.x,target.s-pose.s));
 const errors=[];
 for(let i=0;i<64;i++){
  r.cooldown=0;r.projectiles=[];updateWeapons(r,{fire:true},0);
  const p=r.projectiles[0],dyaw=-Math.atan2(p.vx,p.vs)-yaw,dpitch=Math.atan2(p.vy,Math.hypot(p.vx,p.vs))-pitch;
  assert(Math.abs(dyaw)<=CLU_WEAPON.assistYawSpread);assert(Math.abs(dpitch)<=CLU_WEAPON.assistPitchSpread);
  errors.push({yaw:dyaw,pitch:dpitch});
 }
 assert(errors.some(e=>Math.abs(e.yaw)>CLU_WEAPON.yawSpread));
 assert(errors.some(e=>Math.abs(e.pitch)>CLU_WEAPON.pitchSpread*3));
 assert(errors.some(e=>e.yaw<0)&&errors.some(e=>e.yaw>0));
});
