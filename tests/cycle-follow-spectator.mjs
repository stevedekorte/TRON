import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:60000});
 await page.evaluate(()=>{
  const r=__tron.state.cycleRace;r.arenaPaused=true;
  for(const b of r.cycles)Object.assign(b,{alive:b.id!==r.playerId,x:b.id*10,previousX:b.id*10,z:0,previousZ:0,progress:1,dir:0,turboCharge:(b.id+1)/10,brakeCharge:(6-b.id)/10,boosting:b.id===2,braking:b.id===3});
  __tron.place({cycleRace:r});
 });
 await page.waitForFunction(()=>__tron.state.cycleSpectating&&__tron.state.cycleFollowId===null);
 await page.waitForTimeout(3300);
 await page.waitForFunction(()=>document.querySelector('#turbo-fill').style.transform==='scaleX(0.1)'&&document.querySelector('#cycle-brake-fill').style.transform==='scaleX(0.6)');
 await page.screenshot({path:'test-results/cycle-death-overview.png'});
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>__tron.state.cycleFollowId===0);
 await page.waitForFunction(()=>document.querySelector('#cycle-controls').textContent.includes('ENTER TO RESTART'));
 assert.equal(await page.locator('#cycle-controls').textContent(),'CYCLE DETROYED - ARROW KEYS TO FOLLOW - ENTER TO RESTART');
 for(const [key,id] of [['ArrowRight',2],['ArrowRight',3],['ArrowLeft',2],['ArrowLeft',0],['ArrowLeft',5],['ArrowRight',0]]){
  await page.keyboard.press(key);await page.waitForFunction(id=>__tron.state.cycleFollowId===id,id);
  await page.waitForTimeout(50);
  const s=await page.evaluate(()=>__tron.state),b=s.cycleRace.cycles[id];
  const meters=await page.evaluate(()=>({turbo:document.querySelector('#turbo-fill').style.transform,brake:document.querySelector('#cycle-brake-fill').style.transform,boosting:document.querySelector('#turbo').classList.contains('boosting'),braking:document.querySelector('#cycle-brake').classList.contains('boosting')}));
  assert.equal(meters.turbo,`scaleX(${b.turboCharge})`);assert.equal(meters.brake,`scaleX(${b.brakeCharge})`);
  assert.equal(meters.boosting,b.boosting);assert.equal(meters.braking,b.braking);
  assert(!s.camera.free);assert.equal(s.cycleRace.playerId,1);
  assert(Math.hypot(s.camera.x-(s.cycleRace.site.x+b.x*4.8),s.camera.z-(-s.cycleRace.site.s+b.z*4.8))<15);
 }
 await page.evaluate(()=>{const r=__tron.state.cycleRace;r.cycles[0].alive=false;__tron.place({cycleRace:r});});
 await page.waitForFunction(()=>__tron.state.cycleFollowId===2);
 await page.waitForFunction(()=>document.querySelector('#turbo-fill').style.transform==='scaleX(0.3)'&&document.querySelector('#cycle-brake-fill').style.transform==='scaleX(0.4)');
 await page.screenshot({path:'test-results/cycle-follow-spectator.png'});
 const round=await page.evaluate(()=>__tron.state.cycleRace.round);
 await page.keyboard.press('Enter');
 await page.waitForFunction(round=>__tron.state.cycleRace.round===round+1&&!__tron.state.cycleSpectating,round);
 assert.deepEqual(errors,[]);
 console.log('Cycle death message, left/right survivor selection, wraparound, target death and restart passed.');
}finally{await browser.close();}
