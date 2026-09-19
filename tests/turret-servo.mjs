import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {servoMotion} from '../src/audio/turret-servo.js';
const still={time:0,turretYaw:0,aimPitch:0};
let motion=servoMotion(null,still);assert.equal(motion.speed,0);
motion=servoMotion(motion,{...still,time:1/60,turretYaw:.01});assert.ok(motion.speed>0);
assert.equal(servoMotion(motion,{...still,time:1/60}),motion);
assert.equal(servoMotion(motion,{...still,time:2/60,turretYaw:.01}).speed,0);
assert.equal(servoMotion(motion,{...still,time:0}).speed,0);
const initial=servoMotion(null,still);assert.ok(servoMotion(initial,{...still,time:1/60,aimPitch:.01}).speed>0);
assert.equal(servoMotion(initial,{...still,time:1/60,yaw:1}).speed,0);
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5174');
 const levels=await page.evaluate(async()=>{
  const {createTurretServo}=await import('/src/audio/turret-servo.js');const results={};
  for(const state of ['moving','stopped','paused','destroyed','reset']){
   const c=new OfflineAudioContext(2,44100,44100),servo=createTurretServo(c,c.destination);
   servo.update({time:0,turretYaw:0,aimPitch:0},true);
   const r={time:1/60,turretYaw:.02,aimPitch:0,crushed:state==='destroyed'};servo.update(r,state!=='paused');
   if(state==='stopped')servo.update({...r,time:2/60},true);if(state==='reset')servo.reset();
   const b=await c.startRendering();let sum=0;for(const v of b.getChannelData(0))sum+=v*v;
   results[state]=Math.sqrt(sum/b.length);servo.dispose();
  }
  return results;
 });
 assert.ok(levels.moving>.01);for(const key of ['stopped','paused','destroyed','reset'])assert.ok(levels[key]<.00001,`${key}: ${levels[key]}`);
 console.log('Servo follows yaw/elevation motor motion, holds between simulation ticks, ignores hull-only rotation, and silences on stop/pause/death/reset.',levels);
}finally{await browser.close();}
