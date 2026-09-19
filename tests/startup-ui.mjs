import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const blocked=new Promise(r=>release=r);
 await page.route('**/src/ui/style.css',async route=>{await blocked;await route.continue();});
 const navigation=page.goto('http://127.0.0.1:5173');
 await page.waitForFunction(()=>!!document.body);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(0, 0, 0)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).visibility),'hidden');release();await navigation;
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).visibility),'visible');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>['entering','running'].includes(__tron.state.mode));
 assert.ok(await page.locator('#hint').isVisible());
 await page.waitForFunction(()=>__tron.state.mode==='running');
 assert.equal(await page.locator('#hint').evaluate(e=>e.classList.contains('faded')),false);
 await page.keyboard.press('KeyW');await page.waitForTimeout(11000);
 assert.equal(await page.locator('#hint').evaluate(e=>e.classList.contains('faded')),true);
 await page.keyboard.press('KeyW');await page.waitForTimeout(3500);
 assert.equal(await page.locator('#hint').evaluate(e=>e.classList.contains('faded')),false);
 assert.deepEqual(errors,[]);console.log('Delayed CSS stays black/hidden; controls show on entry, fade 10 seconds after first key, then idle reminder returns.');
}finally{await browser.close();}
