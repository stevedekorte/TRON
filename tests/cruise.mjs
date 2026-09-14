import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('Shift+KeyW');assert.ok(await page.evaluate(()=>__tron.state.cruiseThrottle));await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>__tron.state.speed)>=22);
 await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>__tron.state.cruiseThrottle),false);const speed=await page.evaluate(()=>__tron.state.speed);await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>__tron.state.speed)<speed);
 await page.keyboard.press('Escape');await page.evaluate(()=>__tron.place({speed:-5}));await page.keyboard.press('KeyS');await page.keyboard.down('KeyS');await page.keyboard.press('KeyT');await page.waitForTimeout(100);const state=await page.evaluate(()=>__tron.state);assert.ok(state.speed< -40&&state.speed>=-41.25);await page.keyboard.up('KeyS');console.log('Shift-W latches, W releases, and T boosts backward with the reverse cap.');
}finally{await browser.close();}
