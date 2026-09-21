import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];let request;
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'local',small:false})));
 await page.route('**/api/jev/decision',async route=>{
  request=route.request().postDataJSON();
  const option=request.options.find(o=>o.kind==='investigate-sound')||request.options[0];
  await route.fulfill({contentType:'application/json',body:JSON.stringify({id:option.id,confidence:.9})});
 });
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron?.state.mode==='running');
 await page.evaluate(()=>{
  const e=__tron.state.recognizers[0];
  Object.assign(e,{x:-5000,s:-5000,y:80,yaw:-Math.PI/2,vx:0,vs:0,vy:0,yawVelocity:0,nextSense:Infinity,nextRadio:Infinity,canSee:false,memory:null,attack:null,tactical:null,hearing:[],state:'wander'});
  __tron.place({x:-5300,s:-5000,yaw:0,speed:0,cruiseThrottle:false,recognizers:[e],enemyTanks:[],dataBeams:[],radio:[],events:[]});
 });
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>__tron.state.recognizers[0].tactical?.plan?.kind==='investigate-sound');
 const heard=await page.evaluate(()=>{const e=__tron.state.recognizers[0];return {sounds:e.hearing,memory:e.memory,canSee:e.canSee};});
 assert.ok(heard.sounds.some(h=>h.type==='cannon fire'));assert.equal(heard.memory,null);assert.equal(heard.canSee,false);
 await page.evaluate(async()=>{const {config}=await import('/src/game/config.js');config.aiMode='jev';});
 await page.waitForFunction(()=>__tron.state.aiHistory.some(h=>h.accepted));
 assert.equal(request.target,null);assert.ok(request.sounds.some(h=>h.type==='cannon fire'));assert.ok(request.options.some(o=>o.kind==='investigate-sound'));
 await page.keyboard.press('Escape');const t=await page.evaluate(()=>__tron.state.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__tron.state.time),t);
 assert.deepEqual(errors,[]);console.log('Real cannon event -> hearing -> local investigation -> mocked Jev choice; no visual target leak; pause passed.');
}finally{await browser.close();}
