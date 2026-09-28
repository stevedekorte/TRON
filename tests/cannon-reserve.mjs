import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 assert.equal(await page.evaluate(()=>__tron.state.extraShots),3);
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,recognizers:[],enemyTanks:[],extraShots:3,cooldown:10,shotRest:0}));
 await page.waitForFunction(()=>document.querySelectorAll('#shots-meter .ready').length===3);
 const initial=await page.evaluate(()=>__tron.state.shots);
 // Long existing cooldown proves real key presses spend the reserve.
 for(let i=1;i<=3;i++){
  await page.keyboard.press('Space');
  await page.waitForFunction(n=>__tron.state.shots>=n,initial+i);
  assert.equal(await page.evaluate(()=>__tron.state.extraShots),3-i);
  await page.waitForFunction(n=>document.querySelectorAll('#shots-meter .ready').length===n,3-i);
  assert.equal(await page.locator('#shots-meter').getAttribute('aria-valuenow'),String(3-i));
 }
 await page.keyboard.down('Space');await page.waitForTimeout(500);await page.keyboard.up('Space');
 assert.equal(await page.evaluate(()=>__tron.state.extraShots),0);
 const charge=()=>page.locator('#shots-meter i').first().evaluate(el=>Number(el.style.getPropertyValue('--charge')));
 const partial=await charge();assert(partial>0&&partial<1);
 await page.waitForTimeout(400);assert(await charge()>partial);
 await page.keyboard.press('Escape');const pausedCharge=await charge();const before=await page.evaluate(()=>__tron.state.extraShots);
 await page.waitForTimeout(1100);assert.equal(await charge(),pausedCharge);assert.equal(await page.evaluate(()=>__tron.state.extraShots),before);
 const checkpoint=await page.evaluate(()=>({time:__tron.state.time,shots:__tron.state.shots,rest:__tron.state.shotRest}));
 await page.keyboard.press('Enter');
 for(let count=1;count<=3;count++){
  await page.waitForFunction(n=>__tron.state.extraShots===n,count,{timeout:60000});
  await page.waitForFunction(n=>document.querySelectorAll('#shots-meter .ready').length===n,count);
  const elapsed=await page.evaluate(()=>__tron.state.time);
  assert(Math.abs(elapsed-checkpoint.time+checkpoint.rest-count*5)<.3);
 }
 console.log('Natural recharge:',checkpoint,await page.evaluate(()=>({time:__tron.state.time,shots:__tron.state.shots,rest:__tron.state.shotRest})));
 await page.waitForFunction(()=>document.querySelectorAll('#shots-meter .ready').length===3);
 console.log('Space presses spend banked extras; held fire uses normal recharge; pausing stops refill.');
}finally{await browser.close();}
