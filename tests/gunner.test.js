import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,cannonPose,cannonTarget,updateWeapons} from '../src/simulation/run.js';
import {angleDelta,GUNNER,gunnerAimScale} from '../src/game/config.js';
function fixture(){const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,gunner:true});r.recognizers=[];r.enemyTanks=[];return r;}
test('gunner aim holds world heading through hull turns; manual aim stays independent',()=>{const r=fixture();r.turretYaw=.7;for(let i=0;i<300;i++)step(r,{steer:.5},1/60);assert.ok(Math.abs(angleDelta(.7,r.yaw+r.turretYaw))<1e-8);const old=r.yaw+r.turretYaw;step(r,{turret:1,steer:1,aimPitch:1},1/60);assert.ok(angleDelta(old,r.yaw+r.turretYaw)<0);assert.ok(r.aimPitch>0);});
test('manual gunner rounds follow sight elevation without target assistance',()=>{const r=fixture();r.aimPitch=.6;const p=cannonPose(r);updateWeapons(r,{fire:true},0);const shot=r.projectiles[0];assert.ok(Math.abs(Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vs))-.6)<1e-8);assert.equal(shot.x,p.x);for(let i=0;i<600;i++)step(r,{aimPitch:1},1/60);assert.equal(r.aimPitch,GUNNER.maxPitch);for(let i=0;i<600;i++)step(r,{aimPitch:-1},1/60);assert.equal(r.aimPitch,GUNNER.minPitch);});

test('zoom scales horizontal and vertical aiming to preserve screen-space sensitivity',()=>{const samples=[0,1,2,3].map(gunnerZoom=>{const r=fixture();r.gunnerZoom=gunnerZoom;step(r,{turret:1,aimPitch:1},1/60);return r;});for(let z=1;z<4;z++){assert.ok(Math.abs(samples[z].turretYaw/samples[0].turretYaw-gunnerAimScale(z))<1e-8);assert.ok(Math.abs(samples[z].aimPitch/samples[0].aimPitch-gunnerAimScale(z))<1e-8);assert.ok(Math.abs(samples[z].turretYaw)<Math.abs(samples[z-1].turretYaw));}});

test('gunner aim accelerates, coasts to rest, and can reverse without snapping',()=>{const r=fixture();step(r,{turret:1,aimPitch:1},1/60);const first=r.gunnerYawMotion;assert.ok(first>0&&first<.5);for(let i=0;i<20;i++)step(r,{turret:1,aimPitch:1},1/60);assert.ok(r.gunnerYawMotion>.95);const before=r.turretYaw;step(r,{},1/60);assert.ok(r.gunnerYawMotion>0&&r.gunnerYawMotion<.9);assert.ok(r.turretYaw<before);for(let i=0;i<60;i++)step(r,{},1/60);assert.equal(r.gunnerYawMotion,0);assert.equal(r.gunnerPitchMotion,0);for(let i=0;i<30;i++)step(r,{turret:1},1/60);step(r,{turret:-1},1/60);assert.ok(r.gunnerYawMotion>0);for(let i=0;i<20;i++)step(r,{turret:-1},1/60);assert.ok(r.gunnerYawMotion<-.9);r.gunner=false;step(r,{},1/60);assert.equal(r.gunnerYawMotion,0);});

test('leveling returns elevation to the ground plane without changing azimuth; manual elevation cancels',()=>{const r=fixture();r.aimPitch=.6;r.turretYaw=.8;r.gunnerLeveling=true;step(r,{},1/60);assert.ok(r.aimPitch>0&&r.aimPitch<.6);for(let i=0;i<100;i++)step(r,{},1/60);assert.equal(r.aimPitch,0);assert.equal(r.gunnerLeveling,false);assert.ok(Math.abs(r.turretYaw-.8)<1e-8);r.aimPitch=.4;r.gunnerLeveling=true;step(r,{aimPitch:1},1/60);assert.equal(r.gunnerLeveling,false);assert.ok(r.aimPitch>.4);});

test('Clu rounds travel 825 meters and assisted fire reaches beyond the old range',()=>{const r=fixture();r.seed=42;r.gunner=false;updateWeapons(r,{fire:true},0);assert.equal(r.projectiles[0].life,5);assert.ok(Math.abs(Math.hypot(r.projectiles[0].vx,r.projectiles[0].vs,r.projectiles[0].vy)-165)<1e-10);const e={...createRun().recognizers[0],x:-5000,s:-4400,y:77,yaw:0,vx:0,vs:0,vy:0};r.recognizers=[e];r.projectiles=[];r.cooldown=0;assert.ok(cannonTarget(r).lock);for(let i=0;i<270;i++)updateWeapons(r,{fire:i===0},1/60);assert.ok(r.events.some(event=>event.hitPart));});

test('forward-and-level return uses manual rates and acceleration at every zoom',()=>{
 for(const gunner of [false,true])for(const gunnerZoom of [0,1,2,3]){
  const auto=fixture();Object.assign(auto,{gunner,gunnerZoom,turretYaw:1.2,aimPitch:.7,turretCentering:true,gunnerLeveling:true});
  const manual=structuredClone(auto);manual.turretCentering=false;manual.gunnerLeveling=false;
  for(let i=0;i<12;i++){
   step(auto,{},1/60);step(manual,{turret:1,aimPitch:-1},1/60);
   assert.ok(Math.abs(auto.turretYaw-manual.turretYaw)<1e-10);
   if(gunner)assert.ok(Math.abs(auto.aimPitch-manual.aimPitch)<1e-10);
  }
  for(let i=0;i<1800&&(auto.turretCentering||auto.gunnerLeveling);i++)step(auto,{},1/60);
  assert.equal(auto.turretYaw,0);assert.equal(auto.aimPitch,0);
  assert.equal(auto.turretCentering,false);assert.equal(auto.gunnerLeveling,false);
 }
});
test('return centers relative to a turning hull and manual controls override each axis',()=>{
 const r=fixture();Object.assign(r,{turretYaw:1,aimPitch:.3,turretCentering:true,gunnerLeveling:true});
 for(let i=0;i<180&&r.turretCentering;i++)step(r,{steer:1},1/60);
 assert.equal(r.turretYaw,0);assert.notEqual(r.yaw,0);
 Object.assign(r,{turretYaw:1,aimPitch:.3,turretCentering:true,gunnerLeveling:true});
 step(r,{turret:-1,aimPitch:1},1/60);
 assert.equal(r.turretCentering,false);assert.equal(r.gunnerLeveling,false);
});

test('stabilization holds world heading in every view and catches up within its motor limit',()=>{
 for(const gunner of [false,true])for(const gunnerZoom of [0,3]){
  const r=fixture();Object.assign(r,{gunner,gunnerZoom,turretYaw:.7});
  for(let i=0;i<120;i++)step(r,{steer:.5},1/60);
  assert.ok(Math.abs(angleDelta(.7,r.yaw+r.turretYaw))<1e-8);
  for(let i=0;i<300;i++){
   const before=r.turretYaw;step(r,{steer:1},1/60);
   assert.ok(Math.abs(angleDelta(before,r.turretYaw))<=1.2/60+1e-9);
  }
  assert.ok(Math.abs(angleDelta(.7,r.yaw+r.turretYaw))>.01,'hull can outrun the motor');
  for(let i=0;i<180;i++)step(r,{},1/60);
  assert.ok(Math.abs(angleDelta(.7,r.yaw+r.turretYaw))<1e-8);
 }
});
test('manual aiming and hull compensation share one motor budget without queued input',()=>{
 for(const gunner of [false,true])for(const direction of [-1,1]){
  const r=fixture();r.gunner=gunner;
  for(let i=0;i<240;i++){
   const before=r.turretYaw;step(r,{steer:direction,turret:-direction},1/60);
   assert.ok(Math.abs(angleDelta(before,r.turretYaw))<=1.2/60+1e-9);
  }
  for(let i=0;i<180;i++)step(r,{},1/60);
  const heading=r.yaw+r.turretYaw;
  for(let i=0;i<120;i++)step(r,{},1/60);
  assert.ok(Math.abs(angleDelta(heading,r.yaw+r.turretYaw))<1e-8);
 }
});

import {stabilizeTurret} from '../src/simulation/turret.js';
test('sudden external hull rotations cannot bypass the turret motor limit',()=>{
 for(const rate of [1.2,1.3]){
  const tank={yaw:0,turretYaw:.4},heading=.4;
  for(const yaw of [2.8,-2.8,7,-9,0]){
   tank.yaw=yaw;const before=tank.turretYaw;
   stabilizeTurret(tank,heading,rate,1/60);
   assert.ok(Math.abs(angleDelta(before,tank.turretYaw))<=rate/60+1e-9);
   const stopped=tank.turretYaw;stabilizeTurret(tank,heading,rate,0);assert.ok(Math.abs(angleDelta(stopped,tank.turretYaw))<1e-9);
  }
 }
 const r=fixture();r.turretYaw=.4;step(r,{},1/60);r.yaw+=2;
 const before=r.turretYaw;step(r,{},1/60);
 assert.ok(Math.abs(angleDelta(before,r.turretYaw))<=1.2/60+1e-9);
 assert.ok(Math.abs(angleDelta(.4,r.yaw+r.turretYaw))>1.9);
 for(let i=0;i<180;i++)step(r,{},1/60);
 assert.ok(Math.abs(angleDelta(.4,r.yaw+r.turretYaw))<1e-8);
});

test('mouse target leads the sight, converges, and respects motor and zoom limits',()=>{
 for(let zoom=0;zoom<4;zoom++){
  const r=fixture();r.gunnerZoom=zoom;
  step(r,{mouseTarget:{yaw:-.45*gunnerAimScale(zoom),pitch:.2*gunnerAimScale(zoom)}},1/60);
  const goal={...r.mouseAim};assert.ok(goal.yaw<r.turretYaw);assert.ok(goal.pitch>r.aimPitch);
  for(let i=0;i<300;i++){
   const yaw=r.turretYaw,pitch=r.aimPitch;
   step(r,{},1/60);
   assert.ok(Math.abs(angleDelta(yaw,r.turretYaw))<=1.2/60+1e-9);
   assert.ok(Math.abs(r.aimPitch-pitch)<=GUNNER.pitchRate*gunnerAimScale(zoom)/60+1e-9);
  }
  assert.ok(Math.abs(angleDelta(goal.yaw,r.yaw+r.turretYaw))<1e-6);
  assert.ok(Math.abs(goal.pitch-r.aimPitch)<1e-6);
  step(r,{mouseTarget:{yaw:-1,pitch:.2},steer:1},1/60);const before=r.turretYaw;r.yaw+=2;
  step(r,{mouseTarget:{yaw:-1,pitch:.2},steer:1},1/60);assert.ok(Math.abs(angleDelta(before,r.turretYaw))<=1.2/60+1e-9);
  step(r,{turret:-1},1/60);assert.equal(r.mouseAim,null);
  step(r,{mouseTarget:{yaw:-.2,pitch:.1}},1/60);r.gunner=false;step(r,{},1/60);assert.equal(r.mouseAim,null);
 }
});


test('forward lock follows hull indefinitely, releasing only on aiming input',()=>{
 const r=fixture();Object.assign(r,{turretYaw:1,aimPitch:.5,turretCentering:true,gunnerLeveling:true,turretLocked:true});
 for(let i=0;i<600;i++)step(r,{steer:1,throttle:1},1/60);
 assert.equal(r.turretYaw,0);assert.equal(r.aimPitch,0);assert.equal(r.turretLocked,true);
 r.yaw+=2;step(r,{fire:true},1/60);assert.equal(r.turretYaw,0);assert.equal(r.turretLocked,true);
 r.steer=0;step(r,{turret:1},1/60);assert.equal(r.turretLocked,false);assert.ok(r.turretYaw<0);
 r.turretLocked=true;step(r,{mouseTarget:{yaw:r.yaw+.4,pitch:.2}},1/60);assert.equal(r.turretLocked,false);
});
test('keyboard and mouse cannot aim below the tank base',()=>{
 const r=fixture();r.aimPitch=.1;
 for(let i=0;i<120;i++)step(r,{aimPitch:-1},1/60);
 assert.equal(r.aimPitch,0);
 for(let i=0;i<120;i++)step(r,{mouseTarget:{yaw:0,pitch:-.6}},1/60);
 assert.equal(r.aimPitch,0);assert.equal(r.mouseAim.pitch,0);
});


test('mouse tracking bounds acceleration and speed through target jumps and reversals',()=>{
 for(const zoom of [0,1,2,3]){
  const r=fixture();r.gunnerZoom=zoom;r.aimPitch=.6;
  const scale=gunnerAimScale(zoom),dt=1/60;let lastYawRate=0,lastPitchRate=0;
  for(let i=0;i<300;i++){
   const yaw=r.turretYaw,pitch=r.aimPitch;
   const target={yaw:i<40?-1:i<95?.8:-.2,pitch:i<40?1:i<95?.3:.6};
   step(r,{mouseTarget:target},dt);
   const yawRate=angleDelta(yaw,r.turretYaw)/dt,pitchRate=(r.aimPitch-pitch)/dt;
   assert.ok(Math.abs(yawRate)<=1.2*scale+1e-8);
   assert.ok(Math.abs(pitchRate)<=GUNNER.pitchRate*scale+1e-8);
   assert.ok(Math.abs(yawRate-lastYawRate)<=6*1.2*scale*dt+1e-8);
   assert.ok(Math.abs(pitchRate-lastPitchRate)<=6*GUNNER.pitchRate*scale*dt+1e-8);
   lastYawRate=yawRate;lastPitchRate=pitchRate;
  }
 }
});

test('gunner hit cue predicts moving tanks and rejects a shot aimed behind their motion',async()=>{
 const {gunnerSolution}=await import('../src/simulation/gunner-solution.js');
 const r=fixture(),pose=cannonPose(r),enemy={...createRun(1982).enemyTanks[0],x:pose.x-20,s:pose.s+165,yaw:0,turretYaw:0,vx:20,vs:0,vy:0};r.enemyTanks=[enemy];
 const hit=gunnerSolution(r);assert.equal(hit.id,enemy.id);assert.ok(hit.time>.9&&hit.time<1.1);
 enemy.vx=0;assert.equal(gunnerSolution(r),null);
 enemy.x=pose.x;assert.equal(gunnerSolution(r).id,enemy.id);
 enemy.state='destroyed';assert.equal(gunnerSolution(r),null);
});
test('gunner cue handles airborne targets, critical regions, range and blocking maze walls',async()=>{
 const {gunnerSolution}=await import('../src/simulation/gunner-solution.js');
 const {WALLS}=await import('../src/levels/maze.js');
 const r=fixture(),pose=cannonPose(r),enemy={...createRun(1982).recognizers[0],x:pose.x,s:pose.s+165,y:pose.y-6*.65,yaw:0,fold:0,vx:0,vs:0,vy:0};r.recognizers=[enemy];
 assert.equal(gunnerSolution(r).critical,true);assert.equal(gunnerSolution(r).part,'crown');
 enemy.s=pose.s+1000;assert.equal(gunnerSolution(r),null);
 const wall=WALLS[0],center=wall.points.reduce((a,p)=>({x:a.x+p.x/wall.points.length,s:a.s+p.s/wall.points.length}),{x:0,s:0});
 Object.assign(r,center);Object.assign(enemy,{x:center.x,s:center.s+100,y:pose.y});assert.equal(gunnerSolution(r),null);
});

test('Clu elevation is capped at 45 degrees and overhead targets receive no assisted lock',()=>{
 assert.equal(GUNNER.maxPitch,Math.PI/4);
 const r=fixture();r.gunner=false;
 const e={...createRun().recognizers[0],x:r.x,s:r.s+30,y:100,vx:0,vs:0,vy:0};r.recognizers=[e];
 assert.equal(cannonTarget(r).lock,false);
 e.s=r.s+200;assert.equal(cannonTarget(r).lock,true);
 r.gunner=true;
 for(let i=0;i<180;i++)step(r,{aimPitch:1},1/60);
 assert.equal(r.aimPitch,Math.PI/4);
 updateWeapons(r,{fire:true},0);
 const shot=r.projectiles.at(-1);
 assert(Math.atan2(shot.vy,Math.hypot(shot.vx,shot.vs))<=Math.PI/4+1e-10);
});

test('releasing a recenter chord one key at a time does not interrupt centering',async()=>{
 const {InputController}=await import('../src/app/input-controller.js');
 const input=new InputController(),r=fixture();
 Object.assign(r,{turretYaw:.5,aimPitch:.3,turretLocked:true,turretCentering:true,gunnerLeveling:true});
 input.keys.add('KeyJ');input.keys.add('KeyL');input.turretCenterChord=true;
 input.release('KeyJ');
 for(let i=0;i<240;i++)step(r,input.command(r),1/60);
 assert(r.turretLocked);assert(Math.abs(r.turretYaw)<.001);assert(Math.abs(r.aimPitch)<.001);
 input.release('KeyL');input.keys.add('KeyJ');step(r,input.command(r),1/60);
 assert(!r.turretLocked);assert(r.turretYaw>0);
});
