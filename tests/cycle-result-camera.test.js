import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {cycleResultTarget} from '../src/rendering/cycle-result-camera.js';
const fixture=()=>({playerVehicle:'cycle',cycleFollowId:2,cycleRace:{round:1,phase:'result',winner:0,playerId:1,site:{x:0,s:0},breaches:[],crashes:[{id:3,time:4},{id:1,time:5}],cycles:[0,1,2,3].map(id=>({id,team:id===3?1:0,alive:true,x:id*5,z:0,previousX:id*5,previousZ:0,dir:0}))}});
test('result prefers player, followed winner, then another winner; ties use last crash',()=>{
 const r=fixture();assert.equal(cycleResultTarget(r).id,1);r.cycleRace.cycles[1].alive=false;assert.equal(cycleResultTarget(r).id,2);
 r.cycleFollowId=3;assert.equal(cycleResultTarget(r).id,0);r.cycleRace.winner=1;assert.equal(cycleResultTarget(r).id,3);
 r.cycleRace.winner=null;assert.equal(cycleResultTarget(r).id,1);
});
test('result camera eases rotation and position, orbits, pauses and resets',()=>{
 const r=fixture(),rig=new CameraRig({wallIntersection:()=>null});rig.camera.position.set(0,40,100);rig.camera.lookAt(0,0,0);
 const start=rig.camera.position.clone(),rotation=rig.camera.quaternion.clone(),camera=rig.cycleResultCamera;
 camera.update(rig,r,r.cycleRace,1/60,'running');assert(rig.camera.position.distanceTo(start)<.01);assert(rig.camera.quaternion.angleTo(rotation)<.001);
 for(let i=0;i<180;i++)camera.update(rig,r,r.cycleRace,1/60,'running');
 assert(Math.abs(rig.camera.position.y-4)<1e-8);assert(Math.abs(Math.hypot(rig.camera.position.x-24,rig.camera.position.z)-10)<1e-8);
 const before=rig.camera.position.clone();camera.update(rig,r,r.cycleRace,1,'paused');assert(rig.camera.position.distanceTo(before)<1e-8);
 camera.update(rig,r,r.cycleRace,1,'running');assert(rig.camera.position.distanceTo(before)>1);
 r.cycleRace.phase='racing';assert.equal(camera.update(rig,r,r.cycleRace,1,'running'),false);assert.equal(camera.shot,null);
});
test('a corner winner stays inside the wall throughout a complete orbit',()=>{
 const r=fixture(),rig=new CameraRig({wallIntersection:()=>null});
 const bike=r.cycleRace.cycles[1];Object.assign(bike,{x:85,z:85,previousX:85,previousZ:85});
 rig.camera.position.set(395,4,395);rig.camera.lookAt(408,1,408);
 for(let i=0;i<2700;i++){
  rig.cycleResultCamera.update(rig,r,r.cycleRace,1/60,'running');
  assert(rig.camera.position.x<412.8&&rig.camera.position.z<412.8);
  assert(Number.isFinite(rig.camera.quaternion.w));
 }
});
