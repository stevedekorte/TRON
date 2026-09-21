import test from 'node:test';
import assert from 'node:assert/strict';
import {HEARING} from '../src/game/hearing.js';
import {hearSound,updateHearing,hearingTarget,hearingReports} from '../src/simulation/hearing.js';
import {createRun,step} from '../src/simulation/run.js';
import {chooseManeuver,tacticalSnapshot} from '../src/simulation/tactical.js';
import {config} from '../src/game/config.js';
import {JevClient} from '../src/ai/jev-client.js';
const listener=()=>({id:7,health:3,x:-5000,s:-5000,y:3,yaw:0,vx:0,vs:0,vy:0,yawVelocity:0,state:'wander',memory:null});
const source=(meters,type='cannon fire',range=HEARING.cannonRangeMeters)=>({type,x:-5000+meters,s:-5000,y:3,range});
test('engines are local while cannon fire and explosions carry farther',()=>{
 const e=listener();
 assert.equal(hearSound(e,source(150,'engine',HEARING.engineMovingRangeMeters),0,0,()=>true),null);
 assert.ok(hearSound(e,source(150),0,0,()=>true));
 assert.equal(hearSound(e,source(800),0,0,()=>true),null);
 assert.ok(hearSound(e,source(800,'explosion',HEARING.explosionRangeMeters),0,0,()=>true));
 assert.equal(hearSound(e,source(1000,'explosion',HEARING.explosionRangeMeters),0,0,()=>true),null);
});
test('bearing and amplitude-based distance are approximate and wall muffling reduces reach',()=>{
 const a=hearSound(listener(),source(100),0,42,()=>true),b=hearSound(listener(),source(100),0,42,()=>false);
 assert.ok(Math.abs(a.bearing+Math.PI/2)<.4);assert.equal(a.relativeBearing,a.bearing);
 assert.ok(a.estimatedDistance>70&&a.estimatedDistance<130);assert.notEqual(a.estimatedPosition.x,-4900);
 assert.ok(b.amplitude<a.amplitude);assert.ok(b.estimatedDistance>a.estimatedDistance);assert.ok(b.distanceUncertainty>a.distanceUncertainty);
 assert.equal(hearSound(listener(),source(200),0,42,()=>false),null);
 assert.equal('source' in a,false);assert.equal('vx' in a,false);
});
test('own sounds are ignored, friendly sounds do not erase unknown engine reports, and memory expires',()=>{
 const e=listener();assert.equal(hearSound(e,{...source(1),emitter:e},0),null);
 hearSound(e,source(20,'engine',100),0,1,()=>true);
 hearSound(e,{...source(10,'engine',100),friendly:true},1,2,()=>true);
 assert.equal(hearingReports(e,1).length,2);assert.equal(hearingTarget(e,1).affiliation,'unknown');
 assert.equal(hearingTarget(e,12),null);assert.deepEqual(hearingReports(e,12),[]);
 for(const state of ['materializing','destroyed']){e.state=state;assert.equal(hearSound(e,source(1),0),null);}
 e.state='wander';e.teleport={};assert.equal(hearSound(e,source(1),0),null);
});
test('simulation captures shot origin once, even if events are retained, and reset has no reports',()=>{
 const r=createRun(1982),e=listener();r.recognizers=[e];r.enemyTanks=[];Object.assign(r,{x:-4800,s:-5000,crushed:true,time:1});
 const event={type:'shot',x:-4900,s:-5000,y:3};r.events=[event];updateHearing(r);
 const report=e.hearing[0];assert.equal(report.type,'cannon fire');
 r.time=2;r.x=9000;updateHearing(r);assert.deepEqual(e.hearing[0],report);
 r.events=[];r.time=12;updateHearing(r);assert.deepEqual(e.hearing,[]);
 assert.ok(createRun(1982).recognizers.every(e=>!e.hearing?.length));
});
test('hearing produces an investigation and Jev input without creating sight or attack knowledge',async()=>{
 const before=config.aiMode;config.aiMode='jev';let sent;
 const e=listener();e.y=80;hearSound(e,source(100),0,42,()=>true);
 const plan=chooseManeuver(e,0,[e]);assert.equal(plan.kind,'investigate-sound');assert.equal(e.memory,null);assert.ok(!e.canSee);
 const r={time:0,recognizers:[e],enemyTanks:[],x:10000,s:10000};
 const client=new JevClient(async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({id:plan.id,confidence:1})};});
 try{
  client.update(r,true);await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(sent.target,null);assert.equal(sent.sounds[0].type,'cannon fire');assert.equal(e.tactical.source,'jev');
  const snapshot=tacticalSnapshot(e,0,[e]);r.x=-20000;r.s=-20000;
  assert.deepEqual(tacticalSnapshot(e,0,[e]),snapshot);assert.equal(e.memory,null);
  chooseManeuver(e,11,[e]);assert.notEqual(e.tactical.plan?.kind,'investigate-sound');
 }finally{client.dispose();config.aiMode=before;}
});
test('a real player cannon shot is audible behind an observer without granting visual contact',()=>{
 const before=config.aiMode;config.aiMode='local';
 try{
  const r=createRun(1982),e=listener();e.y=80;e.yaw=-Math.PI/2;e.nextSense=Infinity;e.nextRadio=Infinity;
  Object.assign(r,{x:-5150,s:-5000,yaw:0,speed:0,recognizers:[e],enemyTanks:[],dataBeams:[]});
  step(r,{fire:true},1/60);assert.ok(e.hearing.some(h=>h.type==='cannon fire'));
  step(r,{},1/60);assert.equal(e.tactical.plan.kind,'investigate-sound');assert.equal(e.memory,null);assert.ok(!e.canSee);assert.ok(!e.attack);
 }finally{config.aiMode=before;}
});
