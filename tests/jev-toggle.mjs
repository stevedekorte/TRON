import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/decision',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"test"}'}));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('Escape');
 const time=await page.evaluate(()=>__tron.state.time);
 await page.keyboard.press('n');
 await page.waitForFunction(()=>document.querySelector('#jev-stats').textContent.includes('JEV OFF'));
 assert.equal(await page.evaluate(()=>__tron.state.mode),'paused');
 assert.equal(await page.evaluate(()=>__tron.state.time),time);
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyN',repeat:true})));
 assert.match(await page.locator('#jev-stats').textContent(),/JEV OFF/);
 await page.keyboard.press('n');await page.waitForFunction(()=>document.querySelector('#jev-stats').textContent.includes('JEV ON'));
 await page.keyboard.press('u');await page.waitForFunction(()=>document.querySelector('#autoplay-toggle').getAttribute('aria-pressed')==='true');
 await page.keyboard.press('n');await page.waitForFunction(()=>document.querySelector('#autoplay-toggle').getAttribute('aria-pressed')==='false');
 assert.match(await page.locator('#jev-stats').textContent(),/JEV OFF/);
 await page.keyboard.press('u');await page.waitForFunction(()=>document.querySelector('#jev-stats').textContent.includes('JEV ON'));
 assert.equal(await page.locator('#autoplay-toggle').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);console.log('N toggles JEV without restarting; repeats ignored; disabling disengages autoplay; U re-enables JEV.');
}finally{await browser.close();}
