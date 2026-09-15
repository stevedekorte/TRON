import test from 'node:test';
import assert from 'node:assert/strict';
import {ALERT,raiseAlert,searchlightStrength} from '../src/simulation/alertness.js';
import {createRun,boostTank,step} from '../src/simulation/run.js';
import {perceive,updateRecognizers} from '../src/simulation/recognizers.js';
import {retireTarget} from '../src/simulation/target-memory.js';
import {config,TURBO} from '../src/game/config.js';
test('spotlight requires high alert and loss of a fresh fix; decays without stale-report renewal',()=>{
 const e={state:'wander',canSee:false};assert.equal(searchlightStrength(e,0),0);raiseAlert(e,10);e.canSee=true;assert.equal(searchlightStrength(e,10),0);e.canSee=false;e.memory={seenAt:10};assert.equal(searchlightStrength(e,11),0);assert.equal(searchlightStrength(e,12),1);e.memory=null;assert.equal(searchlightStrength(e,175),.5);raiseAlert(e,10);assert.equal(e.alertUntil,190);assert.equal(searchlightStrength(e,191),0);raiseAlert(e,200);retireTarget(e);assert.equal(searchlightStrength(e,201),0);
});
test('real sighting and cross-unit radio activate alert using original observation time',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,speed:0,time:5});r.recognizers=r.recognizers.slice(0,1);r.enemyTanks=r.enemyTanks.slice(0,1);const e=r.recognizers[0],tank=r.enemyTanks[0];Object.assign(tank,{x:-5000,s:-5100,yaw:0,nextSense:0});Object.assign(e,{x:-5100,s:-5100,nextSense:Infinity});perceive(tank,r,5);assert.equal(tank.alertUntil,5+ALERT.duration);updateRecognizers(r,1/60);r.time=5.5;updateRecognizers(r,1/60);assert.equal(e.alertUntil,5+ALERT.duration);
});
test('reverse turbo stays reverse, caps at 75%, and eases down after boost',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,speed:-5});r.enemyTanks=[];r.recognizers=[];boostTank(r);assert.equal(r.speed,-config.maxSpeed*TURBO.speedMultiplier*.75);step(r,{},1/60);assert.ok(r.speed<0);for(let i=0;i<605;i++)step(r,{throttle:-1},1/60);assert.ok(r.speed< -config.reverseSpeed);for(let i=0;i<180;i++)step(r,{throttle:-1},1/60);assert.equal(r.speed,-config.reverseSpeed);const stopped=createRun();assert.ok(boostTank(stopped,-1));assert.ok(stopped.speed<0);
});

import {SEARCHLIGHT,projectorOrigin,spotlightOnTarget,updateSpotlight} from '../src/simulation/spotlight.js';
function spotlightEncounter(){
 const r=createRun();Object.assign(r,{x:-5000,s:-4800,yaw:0,speed:0,time:5});
 r.recognizers=r.recognizers.slice(0,1);r.enemyTanks=r.enemyTanks.slice(0,1);
 const e=r.recognizers[0];Object.assign(e,{x:-5000,s:-5000,y:75,yaw:0,vx:0,vs:0,vy:0,state:'search',memory:null,canSee:false,alertUntil:185,nextSense:0,nextAttack:Infinity,goal:{x:-4800,s:-4900},goalUntil:100});
 Object.assign(r.enemyTanks[0],{x:-5100,s:-5000,memory:null,nextSense:Infinity});
 return r;
}
test('searcher must illuminate Clu before pursuit and radio, then tracks and fades',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0],receiver=r.enemyTanks[0];
 updateRecognizers(r,1/60);assert.equal(e.spotlight.phase,'acquire');assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.equal(r.radio.length,0);
 const yaw=e.spotlight.yaw;r.time+=1/60;updateRecognizers(r,1/60);
 assert.ok(Math.abs(e.spotlight.yaw-yaw)<=SEARCHLIGHT.yawRate/60+1e-9);
 for(let i=0;i<180&&e.spotlight.phase==='acquire';i++){
  assert.equal(e.canSee,false);assert.equal(e.memory,null);assert.equal(receiver.memory,null);assert.equal(r.radio.length,0);assert.notEqual(e.state,'pursue');
  r.time+=1/60;updateRecognizers(r,1/60);
 }
 assert.equal(e.spotlight.phase,'track');assert.equal(e.canSee,true);assert.equal(e.state,'pursue');assert.ok(spotlightOnTarget(e,r));assert.ok(r.radio.length>0);assert.equal(searchlightStrength(e,r.time),1);
 const confirmed=e.spotlight.confirmedAt;
 while(r.time<confirmed+1){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.ok(receiver.memory);assert.equal(e.spotlight.phase,'track');
 while(r.time<confirmed+1.9){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.equal(e.spotlight.phase,'fade');assert.ok(searchlightStrength(e,r.time)>0&&searchlightStrength(e,r.time)<1);
 while(r.time<confirmed+2.6){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.equal(e.spotlight,null);assert.equal(e.state,'pursue');assert.equal(searchlightStrength(e,r.time),0);
});
test('out-of-range or lost spotlight target cannot be reported, and hidden motion does not steer beam',()=>{
 const r=spotlightEncounter(),e=r.recognizers[0];r.s=e.s+SEARCHLIGHT.range+50;
 for(let i=0;i<180;i++){r.time+=1/60;updateRecognizers(r,1/60);}
 assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.equal(r.radio.length,0);
 r.s=e.s+200;r.time+=.21;updateRecognizers(r,1/60);assert.equal(e.spotlight.phase,'acquire');
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
