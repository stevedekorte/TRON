import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// The cycle view narrows toward full turbo speed and widens toward full brake speed, in chase and first person.
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 const pedal=(boosting,braking)=>page.evaluate(([boosting,braking])=>{const r=__tron.state.cycleRace;r.arenaPaused=true;const b=r.cycles[r.playerId],g=b.gridSpeedMultiplier??1;Object.assign(b,{boosting,braking,speedMultiplier:g*(braking?.5:boosting?2.5:1)});__tron.place({cycleRace:r});},[boosting,braking]);
 const settle=async expected=>{await page.waitForFunction(e=>Math.abs(__tron.state.camera.fov-e)<.3,expected,{timeout:5000}).catch(()=>{});return page.evaluate(()=>__tron.state.camera.fov);};
 await pedal(false,false);const chase=await settle(63);assert(Math.abs(chase-63)<.5,`chase ${chase}`);
 await pedal(true,false);const turbo=await settle(53);assert(Math.abs(turbo-53)<.5,`chase turbo ${turbo}`);
 await pedal(false,true);const brake=await settle(71);assert(Math.abs(brake-71)<.5,`chase brake ${brake}`);
 // __tron.place leaves first person, so drive the real turbo (W) and brake (S) keys here.
 await pedal(false,false);await page.evaluate(()=>{const r=__tron.state.cycleRace;r.arenaPaused=false;r.cycles[r.playerId].human=true;__tron.place({cycleRace:r});});
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix>.99);
 const fp=await settle(95);assert(Math.abs(fp-95)<.5,`first-person cruise ${fp}`);
 await page.keyboard.down('KeyW');const fpTurbo=await settle(89);
 await page.screenshot({path:'test-results/cycle-speed-fov-turbo.png'});await page.keyboard.up('KeyW');
 assert(Math.abs(fpTurbo-89)<.5,`first-person turbo ${fpTurbo}`);
 await page.keyboard.down('KeyS');const fpBrake=await settle(103);
 await page.screenshot({path:'test-results/cycle-speed-fov-brake.png'});await page.keyboard.up('KeyS');
 assert(Math.abs(fpBrake-103)<.5,`first-person brake ${fpBrake}`);
 assert.deepEqual(errors,[]);console.log(`FOV chase ${chase.toFixed(1)}/${turbo.toFixed(1)}/${brake.toFixed(1)}, first person ${fp.toFixed(1)}/${fpTurbo.toFixed(1)}/${fpBrake.toFixed(1)} (cruise/turbo/brake).`);
}finally{await browser.close();}
