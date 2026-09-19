import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron);
 const initial=await page.evaluate(()=>__tron.state);
 assert.equal(initial.recognizers.length,5);
 assert.equal(initial.enemyTanks.length,5);assert.equal(initial.enemyTankVisuals.length,5);
 assert.equal(initial.enemyTanks.filter(e=>e.role==='patrol').length,3);
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.waitForFunction(()=>__tron.state.audioSources===5);
 await page.keyboard.press('KeyW');
 await page.waitForTimeout(7000);
 const patrols=await page.evaluate(()=>__tron.state.enemyTanks.filter(e=>e.role==='patrol'));
 assert(patrols.every(e=>Math.hypot(e.x-initial.enemyTanks[e.index].x,e.s-initial.enemyTanks[e.index].s)>.1),JSON.stringify(patrols.map(e=>({x:e.x,s:e.s,goal:e.patrolGoal,path:e.path,speed:e.speed}))));
 await page.evaluate(()=>{
  const r=__tron.state;
  __tron.place({x:-5000,s:-5000,yaw:0,speed:0,turretYaw:0,radio:[],
   enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'})),
   recognizers:r.recognizers.map((e,i)=>({...e,x:-5000,s:-4500,y:77,yaw:Math.PI,vx:0,vs:0,vy:0,state:i?'destroyed':'search',canSee:false,memory:null,spotlight:null,alertUntil:r.time+180,nextSense:0,nextAttack:Infinity,attack:null,goal:{x:-4700,s:-4950},goalUntil:r.time+20}))});
 });
 await page.waitForFunction(()=>__tron.state.recognizers[0].spotlight?.phase==='acquire');
 const acquiring=await page.evaluate(()=>__tron.state);assert.equal(acquiring.recognizers[0].canSee,false);assert.equal(acquiring.radio.length,0);
 await page.waitForFunction(()=>__tron.state.recognizers[0].spotlight?.phase==='track');
 const tracking=await page.evaluate(()=>__tron.state);assert.equal(tracking.recognizers[0].state,'pursue');assert(tracking.searchlights[0].visible);assert(tracking.searchlights[0].strength>.5);
 await page.screenshot({path:'test-results/spotlight-lock.png'});
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>__tron.state.recognizers[0].spotlight);
 await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>__tron.state.recognizers[0].spotlight),frozen);
 await page.keyboard.press('Enter');await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>__tron.state.recognizers[0].spotlight?.phase),'track');
 await page.evaluate(()=>{const r=__tron.state,e=r.recognizers[0];__tron.place({s:e.s-100});});
 await page.waitForFunction(()=>__tron.state.recognizers[0].spotlight?.phase==='fade');
 await page.waitForFunction(()=>!__tron.state.recognizers[0].spotlight&&!__tron.state.searchlights[0].visible);
 assert.equal(await page.evaluate(()=>__tron.state.recognizers[0].state),'pursue');
 assert.deepEqual(errors,[]);console.log('Blueprint patrols move; 5 Recognizers and 5 tanks render; beam acquires, tracks, pauses and fades before continued pursuit.');
}finally{await browser.close();}
