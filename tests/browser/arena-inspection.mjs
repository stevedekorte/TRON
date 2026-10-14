import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,null,{timeout:120000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('KeyC');
 const initial=await page.evaluate(()=>__tron.state);
 assert(initial.inspection);assert(initial.camera.free);assert.equal(initial.mode,'paused');assert(initial.arena);
 await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
 const moved=await page.evaluate(()=>__tron.state);
 assert(Math.hypot(moved.camera.x-initial.camera.x,moved.camera.z-initial.camera.z)>1);
 assert.equal(moved.time,initial.time);
 await page.keyboard.press('Home');await page.waitForTimeout(300);
 await page.screenshot({path:'test-results/arena-map-inspection.png'});
 await page.keyboard.press('KeyC');
 await page.waitForFunction(()=>!__tron.state.camera.free&&__tron.state.mode==='running');
 assert.equal(await page.evaluate(()=>__tron.state.inspection),false);
 await page.keyboard.press('Escape');await page.keyboard.press('KeyC');await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>__tron.state.mode),'paused');
 await page.keyboard.press('KeyC');
 await page.evaluate(()=>__tron.place({crushed:true,health:0}));
 // place/reset returns the camera to normal; re-enter inspection on the wreck.
 await page.keyboard.press('KeyC');await page.keyboard.press('Space');
 await page.waitForTimeout(3200);
 assert(await page.evaluate(()=>__tron.state.camera.free));
 assert(await page.locator('#intro').isHidden());
 assert(await page.locator('#death-fade').isHidden());
 assert.deepEqual(errors,[]);console.log('Arena loaded; free flight moves while simulation freezes; exit restores running/paused states.');
} finally {await browser.close();}
