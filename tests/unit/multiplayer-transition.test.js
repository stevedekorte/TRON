import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {MP} from '../../shared/multiplayer/config.js';
import {CameraRig} from '../../src/rendering/camera-rig.js';
import {multiplayerFormationShot} from '../../src/rendering/multiplayer-formation-camera.js';

test('formation waits for every current camera, validates round/seat and releases after disconnect',()=>{
 const room=new CycleRoom();room.join('a');room.join('b');
 for(let i=0;i<600;i++)room.step();
 assert(room.race.cameraStaging);assert.equal(room.race.remaining,MP.countdownSeconds);
 const a=room.clients.get('a');
 assert(!room.cameraReady('a',room.race.round-1,a.seat));
 assert(!room.cameraReady('a',room.race.round,null));
 assert(room.cameraReady('a',room.race.round,a.seat));room.step();assert(room.race.cameraStaging);
 room.leave('b');room.step();assert(!room.race.cameraStaging);
 for(let i=0;i<Math.ceil((MP.countdownSeconds+MP.materializationSeconds)*MP.tickHz)+2;i++)room.step();
 assert.equal(room.race.phase,'racing');
 room.nextRound();assert(!a.cameraReady);assert(room.race.cameraStaging);
});
test('result holds the previous roster for five seconds before selecting the next one',()=>{
 const room=new CycleRoom();room.join('a');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 for(const b of room.race.cycles)if(b.team!==0)b.alive=false;
 room.step();assert.equal(room.race.phase,'result');assert.equal(room.race.remaining,5);
 const round=room.race.round,cycles=room.race.cycles;
 for(let i=0;i<599;i++)room.step();assert.equal(room.race.cycles,cycles);
 room.step();room.step();assert.equal(room.race.round,round+1);assert(room.race.cameraStaging);
});
test('each team formation shot frames its three starting cycles in landscape and portrait',()=>{
 const room=new CycleRoom();for(let i=0;i<12;i++)room.join(String(i));
 for(const aspect of [16/9,9/16])for(let team=0;team<4;team++){
  const bike=room.race.cycles.find(b=>b.team===team),shot=multiplayerFormationShot(room.race,bike.id,aspect);
  const camera=new PerspectiveCamera(shot.fov,aspect,.1,12000);camera.position.copy(shot.position);camera.lookAt(shot.look);camera.updateMatrixWorld();
  for(const b of room.race.cycles.filter(b=>b.team===team)){
   const p=new Vector3(b.x*4.8,1,b.z*4.8).project(camera);
   assert(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1,`${team}/${aspect}: ${p.toArray()}`);
  }
 }
});
test('camera holds its formation position through moving launch before cutting to follow',()=>{
 const room=new CycleRoom();room.join('a');const seat=room.clients.get('a').seat;
 const run={playerVehicle:'cycle',multiplayer:{seat},cycleRace:{...room.race,playerId:seat},cycleSpectating:false};
 const rig=new CameraRig({});rig.camera.position.set(0,100,0);
 for(let i=0;i<179;i++)rig.update(run,run,1,1/60,'running',{});
 assert(!rig.multiplayerFormationCamera.shot.ready);
 for(let i=0;i<3;i++)rig.update(run,run,1,1/60,'running',{});
 assert(rig.multiplayerFormationCamera.shot.ready);
 const shot=multiplayerFormationShot(run.cycleRace,seat,rig.camera.aspect);
 assert(rig.camera.position.distanceTo(shot.position)<1e-8);
 run.cycleRace.phase='racing';
 for(let i=0;i<30;i++){
  for(const b of run.cycleRace.cycles)b.z+=.1;
  rig.update(run,run,1,1/60,'running',{});
  assert(rig.multiplayerFormationCamera.shot,'launch shot stays active');
  assert(rig.camera.position.distanceTo(shot.position)<1e-8,'camera stays fixed as bikes move');
 }
 for(let i=0;i<8;i++)rig.update(run,run,1,1/60,'running',{});
 assert.equal(rig.multiplayerFormationCamera.shot,null);assert(rig.camera.position.distanceTo(shot.position)>10);
});

test('all cameras ready immediately starts solo-timed materialization without a countdown',async()=>{
 const {CYCLE_OPENING}=await import('../../src/rendering/cycle-opening.js');
 const room=new CycleRoom();room.join('a');room.cameraReady('a',room.race.round,room.clients.get('a').seat);room.step();
 assert(room.race.materializing);assert(!room.race.cameraStaging);assert.equal(room.race.remaining,MP.materializationSeconds);
 assert.equal(MP.formationSeconds,CYCLE_OPENING.formationSeconds);
 assert.equal(MP.materializationSeconds,CYCLE_OPENING.formationSeconds);
 assert.equal(MP.launchHoldSeconds,CYCLE_OPENING.launchHoldSeconds);
 for(let i=0;i<Math.floor(MP.materializationSeconds*MP.tickHz)-2;i++)room.step();
 assert.equal(room.race.phase,'countdown');
 for(let i=0;i<4;i++)room.step();assert.equal(room.race.phase,'racing');
});

test('formation travel rotates along one shortest arc without an initial detour',()=>{
 const room=new CycleRoom();for(let i=0;i<12;i++)room.join(String(i));
 for(let team=0;team<4;team++){
  const seat=room.race.cycles.find(b=>b.team===team).id;
  const run={playerVehicle:'cycle',multiplayer:{seat},cycleRace:room.race};
  const rig=new CameraRig({});rig.freshCamera=false;
  rig.camera.position.set(0,120,200);rig.camera.lookAt(0,0,0);
  const start=rig.camera.quaternion.clone(),shot=multiplayerFormationShot(room.race,seat,rig.camera.aspect);
  const end=new PerspectiveCamera();end.position.copy(shot.position);end.lookAt(shot.look);
  const total=start.angleTo(end.quaternion);let remaining=total;
  for(let i=0;i<180;i++){
   rig.update(run,run,1,1/60,'running',{});
   const current=rig.camera.quaternion,next=current.angleTo(end.quaternion);
   assert(next<=remaining+1e-6,'rotation never moves away from final heading');
   assert(Math.abs(start.angleTo(current)+next-total)<1e-5,'rotation does not detour toward an intermediate heading');
   remaining=next;
  }
 }
});
