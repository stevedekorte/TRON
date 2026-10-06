import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:500},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:120000});await page.locator('#start').click();
 await page.keyboard.press('Enter');await page.keyboard.press('KeyW');await page.keyboard.up('KeyW');
 try{await page.waitForFunction(()=>__tron.state.mode==='running',null,{timeout:120000});}catch(e){console.log({errors,state:await page.evaluate(()=>({mode:__tron.state.mode,crushed:__tron.state.crushed,opening:__tron.state.opening}))});throw e;}
 await page.evaluate(()=>{
  const e=__tron.state.enemyTanks[0];Object.assign(e,{x:-4960,s:-5000,yaw:0,turretYaw:0,health:3,state:'patrol',nextSense:Infinity,speed:0,patrolGoal:null});
  __tron.place({x:-5000,s:-5000,speed:0,cruiseThrottle:false,health:1,recognizers:[],enemyTanks:[e],projectiles:[{x:-5000,y:2.3,s:-5003.6,vx:0,vs:165,vy:0,life:2,faction:'enemy',owner:e.id}]});
 });
 await page.waitForFunction(()=>__tron.state.crushed);
 const start=await page.evaluate(()=>{window.deathAt=__tron.state.time;return {id:__tron.state.killedBy,enemy:__tron.state.enemyTanks[0].id};});assert.equal(start.id,start.enemy);
 await page.waitForFunction(()=>__tron.state.time-deathAt>=6.8);
 const shot=await page.evaluate(()=>({mode:__tron.state.mode,hidden:document.querySelector('#death-fade').hidden,enemy:__tron.state.enemyTanks[0],camera:__tron.state.camera}));
 assert.equal(shot.mode,'running');assert(shot.hidden);assert(Math.hypot(shot.camera.x-shot.enemy.x,shot.camera.z+shot.enemy.s)<35);
 await page.screenshot({path:'test-results/clu-killer-follow.png'});
 await page.waitForFunction(()=>__tron.state.mode==='ready',null,{timeout:30000});
 const end=await page.evaluate(()=>({duration:__tron.state.time-deathAt,text:document.querySelector('#terminal-text').textContent}));assert(end.duration>=8.8);assert.match(end.text,/CLU PROGRAM DETACHED/);
 assert.deepEqual(errors,[]);console.log({start,end});
}finally{await browser.close();}
