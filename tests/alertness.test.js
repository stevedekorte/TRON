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
