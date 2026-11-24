import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 // Player out, others parked in a row so the observer can follow them.
 await page.evaluate(()=>{const r=__tron.state.cycleRace;r.arenaPaused=true;
  for(const b of r.cycles)Object.assign(b,{alive:b.id!==r.playerId,x:b.id*10,previousX:b.id*10,z:0,previousZ:0,progress:1,dir:0});
  __tron.place({cycleRace:r});});
 await page.waitForFunction(()=>__tron.state.cycleSpectating&&__tron.state.cycleFollowId===null);
 await page.waitForTimeout(3300);
 await page.keyboard.press('KeyP');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>__tron.state.camera.cycleFirstPerson),false,'P does nothing in the overview');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>__tron.state.cycleFollowId===0);
 await page.keyboard.press('KeyP');
 await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix>.98,null,{timeout:10000});
 assert(Math.abs((await page.evaluate(()=>__tron.state.camera.y))-1.3)<.1,'observer camera at rider eye height');
 await page.waitForTimeout(400);
 assert(await page.evaluate(()=>__tron.state.cycleRendering.cockpitOutline.visible),'followed cycle shows the cockpit outline');
 await page.screenshot({path:'test-results/cycles/cycle-observer-first-person/cycle-observer-first-person.png'});
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>__tron.state.cycleFollowId===2);
 await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>__tron.state.camera.cycleFirstPerson),true,'first person persists across follow switches');
 assert(Math.abs((await page.evaluate(()=>__tron.state.camera.y))-1.3)<.1);
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix<.01,null,{timeout:10000});
 await page.waitForFunction(()=>!__tron.state.cycleRendering.cockpitOutline.visible);
 assert(await page.evaluate(()=>__tron.state.camera.y)>2,'chase camera restored');
 assert.deepEqual(errors,[]);console.log('P toggles observer first person on the followed cycle, persists across switches and returns to chase.');
}finally{await browser.close();}
