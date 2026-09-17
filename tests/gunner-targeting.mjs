import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(async()=>{
  const {cannonPose}=await import('/src/simulation/run.js');const r=__tron.state,player={x:-5000,s:-5000,yaw:0,turretYaw:0};const pose=cannonPose(player);
  __tron.configure({enemySpeed:0});__tron.place({...player,speed:0,gunner:true,aimPitch:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map((e,i)=>({...e,x:pose.x,s:pose.s+80,yaw:0,turretYaw:0,speed:0,vx:0,vs:0,state:i?'destroyed':'patrol',nextSense:Infinity,memory:null,partHits:{'left-track':2,'right-track':2}}))});
 });
 await page.waitForFunction(()=>__tron.state.gunnerHit?.id===100&&!__tron.state.camera.gunnerTransition);assert.equal(await page.evaluate(()=>__tron.state.enemyOutlines),true);await page.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('#gunner-center')).transform).b-.5)<.001);assert.equal(await page.locator('#gunner-center').evaluate(e=>getComputedStyle(e).color),'rgb(255, 228, 92)');assert.equal(await page.locator('#gunner-target-cue').count(),0);
 await page.screenshot({path:'test-results/gunner-tank-outline.png'});
 await page.evaluate(()=>__tron.place({turretYaw:1}));await page.waitForFunction(()=>!__tron.state.gunnerHit&&Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('#gunner-center')).transform).a-1)<.001);
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{
  const {cannonPose}=await import('/src/simulation/run.js');const r=__tron.state,pose=cannonPose({...r,turretYaw:0}),pitch=.3;
  __tron.place({turretYaw:0,aimPitch:pitch,enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'})),recognizers:r.recognizers.map((e,i)=>({...e,x:pose.x,s:pose.s+Math.cos(pitch)*165,y:pose.y+Math.sin(pitch)*165-6*.65,yaw:0,fold:0,vx:0,vs:0,vy:0,state:i?'destroyed':'wander',nextSense:Infinity,memory:null}))});
 });
 await page.waitForFunction(()=>__tron.state.gunnerHit?.critical&&Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('#gunner-center')).transform).b-.5)<.001);assert.equal(await page.locator('#gunner-center').evaluate(e=>getComputedStyle(e).color),'rgb(255, 228, 92)');
 await page.keyboard.press('Escape');await page.keyboard.press('KeyP');await page.waitForFunction(()=>!__tron.state.gunner&&!__tron.state.enemyOutlines&&!__tron.state.gunnerHit);
 assert.deepEqual(errors,[]);console.log('Gunner tank outlines and predicted-hit cue render, clear on miss/exit, and indicate Recognizer crown criticals.');
}finally{await browser.close();}
