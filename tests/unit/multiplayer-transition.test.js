import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {MP} from '../../shared/multiplayer/config.js';
import {CameraRig} from '../../src/rendering/camera-rig.js';
import {multiplayerFormationShot} from '../../src/rendering/multiplayer-formation-camera.js';

test('every round seats its humans and materializes at once, waiting for no client',()=>{
 const room=new CycleRoom();room.join('a');room.join('b');
 assert(room.race.materializing);assert.equal(room.race.cameraStaging,false);assert.equal(room.race.remaining,MP.materializationSeconds);
 assert(room.clients.get('a').seat!==null&&room.clients.get('b').seat!==null,'both seated immediately');
 for(let i=0;i<Math.ceil(MP.materializationSeconds*MP.tickHz)+2;i++)room.step();
 assert.equal(room.race.phase,'racing','launches after the materialization alone');
 room.nextRound();assert(room.race.materializing);assert.equal(room.race.cameraStaging,false);
 assert(room.clients.get('a').seat!==null&&room.clients.get('b').seat!==null,'queued humans are seated in the next round at once');
});
test('result holds the previous roster for ten seconds before selecting the next one',()=>{
 const room=new CycleRoom();room.join('a');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 for(const b of room.race.cycles)if(b.team!==0)b.alive=false;
 room.step();assert.equal(room.race.phase,'result');assert.equal(room.race.remaining,10);
 const round=room.race.round,cycles=room.race.cycles;
 for(let i=0;i<MP.resultSeconds*MP.tickHz-1;i++)room.step();assert.equal(room.race.cycles,cycles);
 room.step();room.step();assert.equal(room.race.round,round+1);assert(room.race.materializing);
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
 // The flight spans the materialization (no separate camera wait).
 const frames=Math.ceil(MP.materializationSeconds*60);
 for(let i=0;i<frames-2;i++)rig.update(run,run,1,1/60,'running',{});
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
 // Seat-dependent: the follow camera ends 8.5-15 m from the formation shot.
 assert.equal(rig.multiplayerFormationCamera.shot,null);assert(rig.camera.position.distanceTo(shot.position)>5,'cut away to follow');
});

test('rounds start with solo-timed materialization and no countdown',async()=>{
 const {CYCLE_OPENING}=await import('../../src/rendering/cycle-opening.js');
 const room=new CycleRoom();room.join('a');
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
