import test from 'node:test';
import assert from 'node:assert/strict';
import {ALERT,raiseAlert,searchlightStrength} from '../src/simulation/alertness.js';
import {createRun,boostTank,step} from '../src/simulation/run.js';
import {perceive,updateRecognizers} from '../src/simulation/recognizers.js';
import {retireTarget} from '../src/simulation/target-memory.js';
import {config,TURBO} from '../src/game/config.js';
test('spotlight requires high alert and loss of a fresh fix; decays without stale-report renewal',()=>{
 const e={state:'search',canSee:false};assert.equal(searchlightStrength(e,0),0);raiseAlert(e,10);e.canSee=true;assert.equal(searchlightStrength(e,10),0);e.canSee=false;e.memory={seenAt:10};assert.equal(searchlightStrength(e,11),0);assert.equal(searchlightStrength(e,12),1);e.memory=null;assert.equal(searchlightStrength(e,175),.5);raiseAlert(e,10);assert.equal(e.alertUntil,190);assert.equal(searchlightStrength(e,191),0);raiseAlert(e,200);retireTarget(e);assert.equal(searchlightStrength(e,201),0);
});
test('real sighting and cross-unit radio activate alert using original observation time',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,speed:0,time:5});r.recognizers=r.recognizers.slice(0,1);r.enemyTanks=r.enemyTanks.slice(0,1);const e=r.recognizers[0],tank=r.enemyTanks[0];Object.assign(tank,{x:-5000,s:-5100,yaw:0,nextSense:0});Object.assign(e,{x:-5100,s:-5100,nextSense:Infinity});perceive(tank,r,5);assert.equal(tank.alertUntil,5+ALERT.duration);updateRecognizers(r,1/60);r.time=5.5;updateRecognizers(r,1/60);assert.equal(e.alertUntil,5+ALERT.duration);
});
test('reverse turbo stays reverse, caps at 75%, and eases down after boost',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,speed:-5});r.enemyTanks=[];r.recognizers=[];boostTank(r);assert.equal(r.speed,-5);step(r,{},1/60);assert.ok(r.speed<0);for(let i=0;i<605;i++)step(r,{throttle:-1},1/60);assert.ok(r.speed< -config.reverseSpeed);for(let i=0;i<180;i++)step(r,{throttle:-1},1/60);assert.equal(r.speed,-config.reverseSpeed);const stopped=createRun();assert.ok(boostTank(stopped));assert.equal(stopped.speed,0);
});

import {SEARCHLIGHT,projectorOrigin,spotlightOnTarget,updateSpotlight} from '../src/simulation/spotlight.js';
function spotlightEncounter(){
 const r=createRun();Object.assign(r,{x:-5000,s:-4800,yaw:0,speed:0,time:5});
 r.recognizers=r.recognizers.slice(0,1);r.enemyTanks=r.enemyTanks.slice(0,1);
 const e=r.recognizers[0];Object.assign(e,{x:-5000,s:-5000,y:75,yaw:0,vx:0,vs:0,vy:0,state:'search',memory:null,canSee:false,alertUntil:185,nextSense:0,nextAttack:Infinity,goal:{x:-4800,s:-4900},goalUntil:100});
 Object.assign(r.enemyTanks[0],{x:-5100,s:-5000,memory:null,nextSense:Infinity});
 return r;
}
test('searcher must illuminate Clu before pursuit and radio, then switches the visible beam off',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0],receiver=r.enemyTanks[0];
 updateRecognizers(r,1/60);assert.equal(e.spotlight.phase,'acquire');assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.equal(r.radio.length,0);assert.equal(r.events.filter(e=>e.type==='recognized').length,0);
 const yaw=e.spotlight.yaw;r.time+=1/60;updateRecognizers(r,1/60);
 assert.ok(Math.abs(e.spotlight.yaw-yaw)<=SEARCHLIGHT.acquireYawRate/60+1e-9);
 for(let i=0;i<180&&e.spotlight.phase==='acquire';i++){
  assert.equal(e.canSee,false);assert.equal(e.memory,null);assert.equal(receiver.memory,null);assert.equal(r.radio.length,0);assert.notEqual(e.state,'pursue');
  r.time+=1/60;updateRecognizers(r,1/60);
 }
 assert.equal(e.spotlight.phase,'track');assert.equal(e.canSee,true);assert.equal(e.state,'pursue');assert.ok(spotlightOnTarget(e,r));assert.ok(r.radio.length>0);assert.equal(searchlightStrength(e,r.time),0);
 assert.equal(r.events.filter(e=>e.type==='recognized').length,1);
 const confirmed=e.spotlight.confirmedAt;
 while(r.time<confirmed+1){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.ok(receiver.memory);assert.equal(e.spotlight.phase,'track');assert.equal(r.events.filter(e=>e.type==='recognized').length,1);
 // A distant confirmed target keeps its beam, independent of elapsed time.
 updateSpotlight(e,r.time+10,1/60);assert.equal(e.spotlight.phase,'track');
 e.s=r.s-SEARCHLIGHT.closeRange+1;
 updateSpotlight(e,r.time,1/60);assert.equal(e.spotlight.phase,'fade');
 updateSpotlight(e,r.time+.4,.4);assert.equal(searchlightStrength(e,r.time+.4),0);
 updateSpotlight(e,r.time+1,1/60);assert.equal(e.spotlight,null);assert.equal(e.state,'pursue');

});
test('out-of-range or lost spotlight target cannot be reported, and hidden motion does not steer beam',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0];r.s=e.s+SEARCHLIGHT.range+50;
 for(let i=0;i<180;i++){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.equal(r.radio.length,0);
 // Place the new contact ahead of the aircraft after its moving patrol turn.
 e.state='search';r.x=e.x-Math.sin(e.yaw)*200;r.s=e.s+Math.cos(e.yaw)*200;r.time+=.21;updateRecognizers(r,1/60);assert.equal(e.spotlight.phase,'acquire');
 r.x=-9000;r.time+=.21;updateRecognizers(r,1/60);
 assert.equal(e.spotlight?.target??null,null);
 const a=structuredClone(e),b=structuredClone(e);updateSpotlight(a,r.time+.1,.1);updateSpotlight(b,r.time+.1,.1);assert.deepEqual(a.spotlight,b.spotlight);
 assert.equal(a.spotlight?.yaw,e.spotlight?.yaw);assert.equal(r.radio.length,0);
});

import {WALLS} from '../src/levels/maze.js';
test('an aligned projector cannot confirm Clu through a maze wall',()=>{
 const w=WALLS[0],a=w.points[0],b=w.points[1],dx=b.x-a.x,ds=b.s-a.s,length=Math.hypot(dx,ds),mx=(a.x+b.x)/2,ms=(a.s+b.s)/2;
 const e={x:mx-ds/length*25,s:ms+dx/length*25,y:12,yaw:0};
 const target={x:mx+ds/length*25,s:ms-dx/length*25},origin=projectorOrigin(e);
 e.spotlight={yaw:-Math.atan2(target.x-origin.x,target.s-origin.s),pitch:Math.atan2(2.8-origin.y,Math.hypot(target.x-origin.x,target.s-origin.s))};
 assert.equal(spotlightOnTarget(e,target),false);
});

import {beamPose} from '../src/rendering/searchlights.js';
test('spotlight raises above its scan pitch and reaches Clu beyond the old 260 m limit',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0];r.s=e.s+500;
 for(let i=0;i<300&&!e.canSee;i++){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.equal(e.canSee,true);assert.equal(e.spotlight.phase,'track');
 assert.ok(e.spotlight.pitch>-.18,'aim rises above the scanning pitch limit');
 assert.equal(beamPose(e,r.time),null);
 e.canSee=false;e.state='search';
 const pose=beamPose(e,r.time),distance=Math.hypot(r.x-pose.origin.x,r.s+pose.origin.z,2.8-pose.origin.y);
 assert.ok(pose.range>distance);assert.ok(spotlightOnTarget(e,r));
});
test('free scanning respects the lower angular speed even when a goal jumps',()=>{
 const e={id:0,x:0,s:0,y:80,yaw:0,goal:{x:0,s:200}};
 updateSpotlight(e,0,1/60);const before={...e.scanBeam};e.goal={x:200,s:0};
 updateSpotlight(e,1/60,1/60);
 assert.ok(Math.abs(e.scanBeam.yaw-before.yaw)<=SEARCHLIGHT.yawRate/60+1e-9);
 assert.ok(Math.abs(e.scanBeam.pitch-before.pitch)<=SEARCHLIGHT.pitchRate/60+1e-9);
});

test('confirmed beam fades on lost observation instead of tracking hidden Clu',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0];
 e.spotlight={yaw:0,pitch:-.2,phase:'track',confirmedAt:0,target:null};
 updateSpotlight(e,10,1/60);assert.equal(e.spotlight.phase,'fade');assert.equal(e.spotlight.yaw,0);
 updateSpotlight(e,11,1/60);assert.equal(e.spotlight,null);
});

 test('confirmed spotlight follows turbo cross-traffic with sampled observations and bounded servo speed',()=>{
  const e={id:0,x:-5000,s:-5000,y:85,yaw:0,state:'pursue'},speed=config.maxSpeed*TURBO.speedMultiplier,dt=1/60;
  const target={x:-5100,s:-4875},origin=projectorOrigin(e);
  e.spotlight={phase:'track',yaw:-Math.atan2(target.x-origin.x,target.s-origin.s),pitch:Math.atan2(2.8-origin.y,Math.hypot(target.x-origin.x,target.s-origin.s)),target:{...target,vx:speed,vs:0,seenAt:0}};
  let locked=0;
  for(let i=1;i<=180;i++){
   const now=i*dt;e.x=-5000-speed*now;target.x=-5100+speed*now;
   if(i%12===0)e.spotlight.target={...target,vx:speed,vs:0,seenAt:now};
   const yaw=e.spotlight.yaw,pitch=e.spotlight.pitch;updateSpotlight(e,now,dt);
   assert.ok(Math.abs(e.spotlight.yaw-yaw)<=SEARCHLIGHT.trackYawRate*dt+1e-8);
   assert.ok(Math.abs(e.spotlight.pitch-pitch)<=SEARCHLIGHT.trackPitchRate*dt+1e-8);
   if(spotlightOnTarget(e,target))locked++;
  }
  assert.ok(locked>=175,`kept target lit on ${locked}/180 frames`);
 });

test('high-altitude search ribbons reach ground and stop at raised surfaces',async()=>{
 const THREE=await import('three');
 const {Searchlights}=await import('../src/rendering/searchlights.js');
 for(const surfaceY of [0.04,60]){
  const world={wallIntersection:(a,b)=>surfaceY===.04?null:(a.y-surfaceY)/(a.y-b.y)};
  const scene=new THREE.Scene(),lights=new Searchlights(scene,1,beamPose,world);
  const enemy={x:0,s:0,y:400,yaw:0,id:0,state:'search',alertUntil:180,scanBeam:{yaw:0,pitch:-.18}};
  const camera=new THREE.PerspectiveCamera();camera.position.set(100,500,100);
  lights.update([enemy],1,camera,1,true);
  const geometry=lights.beams[0].mesh.geometry,positions=geometry.attributes.position;
  for(let i=positions.count-33;i<positions.count;i++){
   assert.ok(Math.abs(positions.getY(i)-surfaceY)<1e-4);
   assert.equal(geometry.attributes.surfaceHit.getX(i),1);
  }
  enemy.canSee=true;lights.update([enemy],1,camera,1/60,true);
  assert.equal(lights.beams[0].mesh.visible,false);
  enemy.canSee=false;lights.update([enemy],1,camera,1,true);
  assert.equal(lights.beams[0].mesh.visible,true);
  enemy.state='wander';lights.update([enemy],1,camera,1/60,true);
  assert.equal(lights.beams[0].mesh.visible,false);
  geometry.dispose();lights.beams[0].mesh.material.dispose();
 }
});

test('searchlight stays off during patrol or visible contact, including active projector phases',()=>{
 for(const phase of ['acquire','track','fade']){
  const e={state:'wander',canSee:false,alertUntil:180,spotlight:{phase,fadeAt:10}};
  assert.equal(searchlightStrength(e,10),0);
  e.state='search';assert.equal(searchlightStrength(e,10),1);
  e.canSee=true;assert.equal(searchlightStrength(e,10),0);
  e.canSee=false;e.state='investigate';assert.equal(searchlightStrength(e,10),1);
 }
});
