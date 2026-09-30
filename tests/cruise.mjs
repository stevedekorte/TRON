import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 assert.equal(await page.evaluate(()=>__tron.state.cruiseThrottle),true);
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,yaw:0,recognizers:[],enemyTanks:[],dataBeams:[]}));
 for(const brake of ['KeyS','ArrowDown']){
  await page.keyboard.down(brake);await page.waitForTimeout(200);await page.keyboard.up(brake);
  assert.equal(await page.evaluate(()=>__tron.state.cruiseThrottle),false);
  const speed=await page.evaluate(()=>__tron.state.speed);await page.waitForTimeout(300);
  assert((await page.evaluate(()=>__tron.state.speed))<speed,'releasing brake must not resume forward acceleration');
  await page.keyboard.press('Shift+KeyW');assert.equal(await page.evaluate(()=>__tron.state.cruiseThrottle),true);
  await page.waitForTimeout(500);
 }
 await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>__tron.state.cruiseThrottle),false);
 const speed=await page.evaluate(()=>__tron.state.speed);await page.waitForTimeout(300);assert((await page.evaluate(()=>__tron.state.speed))<speed);
 console.log('Startup uses cruise; S/Down cancel it without reacceleration; Shift-W restores cruise and W releases it.');
}finally{await browser.close();}
