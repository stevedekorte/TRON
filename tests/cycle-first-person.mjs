import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 await page.evaluate(()=>{const r=__tron.state.cycleRace;r.arenaPaused=true;__tron.place({cycleRace:r});});
 await page.keyboard.press('KeyP');
 await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix>.98);
 assert.equal(await page.evaluate(()=>__tron.state.camera.cycleFirstPerson),true);
 assert(Math.abs((await page.evaluate(()=>__tron.state.camera.y))-1.15)<.15);
 assert.equal(await page.evaluate(()=>__tron.state.cycleRendering.bikes[__tron.state.cycleRace.playerId].visible),false,'own cycle hidden inside cockpit');
 await page.screenshot({path:'test-results/cycle-first-person.png'});
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix<.01);
 assert.equal(await page.evaluate(()=>__tron.state.camera.cycleFirstPerson),false);
 assert.deepEqual(errors,[]);console.log('P toggles smooth cockpit entry and return; cockpit height verified.');
}finally{await browser.close();}
