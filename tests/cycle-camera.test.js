import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {cyclePlayerPose} from '../src/simulation/light-cycles.js';

function setup(){
 const bike={id:0,alive:true,previousX:0,x:0,previousZ:0,z:-1,progress:0,dir:0};
 const run={playerVehicle:'cycle',cycleRace:{phase:'racing',playerId:0,site:{x:1700,s:2400},cycles:[bike]}};
 return {bike,run,rig:new CameraRig({})};
}
function frame(rig,run,dt){
 rig.update(run,run,0,dt,'running',{});
 rig.camera.updateMatrixWorld();
 const pose=cyclePlayerPose(run.cycleRace);
 return new Vector3(pose.x,.8,-pose.s).project(rig.camera);
}
test('cycle stays at a stable screen height across fixed steps, duplicate frames and turbo',()=>{
 const {bike,run,rig}=setup(),initial=frame(rig,run,1/60);
 // Render cadence does not always coincide with a new simulation position.
 for(let i=0;i<360;i++){
  if(i%3!==0){bike.progress+=i<180?8/60:20/60;
   if(bike.progress>=1){bike.progress-=1;bike.previousZ--;bike.z--;}}
  const screen=frame(rig,run,[1/144,1/60,1/30][i%3]);
  assert(Math.abs(screen.y-initial.y)<1e-9,`vertical bob at frame ${i}`);
  assert(Math.abs(screen.x-initial.x)<1e-9);
 }
});
test('cycle turns ease the orbit; reset removes the previous match anchor',()=>{
 const {bike,run,rig}=setup();frame(rig,run,1/60);
 bike.dir=1;const pose=cyclePlayerPose(run.cycleRace);
 frame(rig,run,1/60);
 assert(rig.camera.position.x<pose.x&&rig.camera.position.x>pose.x-10);
 for(let i=0;i<180;i++)frame(rig,run,1/60);
 assert(Math.abs(rig.camera.position.x-(pose.x-10))<1e-8);
 rig.reset();assert.equal(rig.cycleAnchor,null);
 bike.x=100;bike.previousX=99;frame(rig,run,1/60);
 assert(Math.abs(rig.camera.position.x-(cyclePlayerPose(run.cycleRace).x-10))<1e-9);
});
test('held J/L glance smoothly toward the rear quarter and release returns forward',()=>{
 for(const direction of [-1,1]){
  const {run,rig}=setup();frame(rig,run,1/60);const position=rig.camera.position.clone();
  rig.cycleGlanceInput=direction;frame(rig,run,1/60);
  assert(rig.cycleGlance*direction<0);assert(Math.abs(rig.cycleGlance)<Math.PI*2/3);
  for(let i=0;i<30;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleGlance)>Math.PI*.65);
  assert(rig.camera.position.distanceTo(position)>5);
  rig.cycleGlanceInput=0;for(let i=0;i<40;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleGlance)<.001);
 }
});
test('side glances keep the horizon level',()=>{
 const {run,rig}=setup();rig.cycleGlanceInput=1;
 for(let i=0;i<30;i++){
  frame(rig,run,1/120);
  const right=new Vector3(1,0,0).applyQuaternion(rig.camera.quaternion);
  assert(Math.abs(right.y)<1e-9);
 }
});
test('cycle render interpolation shares movement with trails without cutting corners',async()=>{
 const {interpolateCycleRace}=await import('../src/rendering/cycle-poses.js');
 const b={alive:true,dir:1,previousX:1,x:2,previousZ:0,z:0,progress:.1,renderTravel:.2,renderPrevious:{x:1,z:.1,dir:0}};
 const race={phase:'racing',cycles:[b]};
 const first=interpolateCycleRace(race,.25).cycles[0];
 assert.equal(first.x,1);assert(Math.abs(first.z-.05)<1e-9);
 const second=interpolateCycleRace(race,.75).cycles[0];
 assert(Math.abs(second.x-1.05)<1e-9);assert.equal(second.z,0);
 assert(Math.abs(second.progress-.05)<1e-9);assert.equal(b.progress,.1);
});

test('orbit glances keep the cycle visible and are slower outside the arena',()=>{
 const arena=setup(),road=setup();road.bike.escaped=true;road.bike.yaw=0;
 for(const s of [arena,road]){frame(s.rig,s.run,1/60);s.rig.cycleGlanceInput=1;}
 for(let i=0;i<12;i++)for(const s of [arena,road]){const p=frame(s.rig,s.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
 assert(Math.abs(road.rig.cycleGlance)<Math.abs(arena.rig.cycleGlance)*.65);
 for(let i=0;i<120;i++){const p=frame(road.rig,road.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
 road.rig.cycleGlanceInput=0;
 for(let i=0;i<120;i++){const p=frame(road.rig,road.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
});

test('road camera anticipates steering while keeping the bike visible and horizon level',()=>{
 for(const sign of [-1,1]){
  const {bike,run,rig}=setup();Object.assign(bike,{escaped:true,yaw:0,roadSpeed:30,steering:sign});
  for(let i=0;i<90;i++){
   const p=frame(rig,run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);
   assert(Math.abs(new Vector3(1,0,0).applyQuaternion(rig.camera.quaternion).y)<1e-9);
  }
  assert(rig.cycleTurnLook*sign<-.5);assert((rig.look.x-cyclePlayerPose(run.cycleRace).x)*sign>3);
  bike.steering=0;for(let i=0;i<120;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleTurnLook)<.001);
  bike.steering=sign;bike.roadSpeed=0;for(let i=0;i<120;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleTurnLook)<.001);
  rig.reset();assert.equal(rig.cycleTurnLook,0);
 }
});

test('cycle aerial view shares Clu height, offset and zoom instead of a separate close overhead view',()=>{
 const {run,rig}=setup();rig.aerial=true;rig.aerialZoom=2;rig.frame={aerialMix:1};
 frame(rig,run,1/60);const pose=cyclePlayerPose(run.cycleRace);
 assert.equal(rig.camera.position.y,1200);
 assert(Math.abs(Math.hypot(rig.camera.position.x-pose.x,rig.camera.position.z+pose.s)-Math.hypot(180,320)*2)<1e-6);
 assert(rig.look.distanceTo(new Vector3(pose.x,0,-pose.s))<1e-6);
});
