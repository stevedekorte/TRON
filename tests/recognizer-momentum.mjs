import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 if(process.env.TRON_CONTAINER){await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(120000);}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>window.__tron);if(process.env.TRON_CONTAINER)await page.evaluate(()=>__tron.configure({renderScale:.5,bloom:0}));await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron?.state.mode==='running');await page.keyboard.press('KeyW');
 await page.evaluate(()=>{
  const r=__tron.state;r.recognizers.forEach((e,i)=>{e.state=i?'destroyed':'wander';e.health=i?0:3;});
  Object.assign(r.recognizers[0],{x:-4950,s:-4700,y:70,yaw:0,yawVelocity:.5,vx:0,vs:10,vy:6,memory:null,canSee:false,attack:null,spotlight:null,nextSense:Infinity,goal:{x:-4550,s:-4700},goalUntil:r.time+100});
  __tron.place({x:-5000,s:-5000,yaw:0,speed:0,cruiseThrottle:false,recognizers:r.recognizers,enemyTanks:[],radio:[]});
 });
 const start=await page.evaluate(()=>({time:__tron.state.time,e:__tron.state.recognizers[0]}));
 const samples=[start];
 for(const seconds of [.2,.6,1.2,2.4]){
  await page.waitForFunction(t=>__tron.state.time>=t,start.time+seconds);
  samples.push(await page.evaluate(()=>({time:__tron.state.time,e:__tron.state.recognizers[0]})));
  await page.screenshot({path:`test-results/recognizer-momentum-${seconds}.png`});
 }
 const early=samples[1].e;assert.ok(early.yaw>0&&early.yawVelocity>0,'rotation carries through the reversed heading request');assert.ok(early.y>start.e.y,'lift retains upward momentum');
 assert.ok(samples.at(-1).e.yawVelocity<0,'turn eventually reverses');
 for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],dt=b.time-a.time;assert.ok(Math.abs(b.e.yawVelocity-a.e.yawVelocity)<=.8*dt+1e-6);assert.ok(Math.abs(b.e.vy-a.e.vy)<=14*dt+1e-6);}
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>__tron.state.recognizers[0]);await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>__tron.state.recognizers[0]),paused);
 const reset=await page.evaluate(()=>{__tron.reset();return __tron.state.recognizers;});assert.ok(reset.every(e=>e.yawVelocity===0&&e.vy===0));const tuned=await page.evaluate(async()=>{const label=[...document.querySelectorAll('#sliders label')].find(e=>e.textContent.includes('Recognizer turnAcceleration'));const input=label.querySelector('input');input.value='1.1';input.dispatchEvent(new Event('input'));const changed=__tron.state.recognizerFlight.turnAcceleration;document.querySelector('#reset-tuning').click();return {changed,reset:__tron.state.recognizerFlight.turnAcceleration,expected:.8};});assert.equal(tuned.changed,1.1);assert.equal(tuned.reset,tuned.expected);assert.deepEqual(errors,[]);
 console.log(samples.map(({time,e})=>({time,yaw:e.yaw,yawVelocity:e.yawVelocity,y:e.y,vy:e.vy})));
}finally{await browser.close();}
