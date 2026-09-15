import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,recognizers:[],enemyTanks:[],extraShots:3,cooldown:10,shotRest:0}));
 const initial=await page.evaluate(()=>__tron.state.shots);
 // Long existing cooldown proves real key presses spend the reserve.
 for(let i=1;i<=3;i++){
  await page.keyboard.press('Space');
  await page.waitForFunction(n=>__tron.state.shots>=n,initial+i);
  assert.equal(await page.evaluate(()=>__tron.state.extraShots),3-i);
 }
 await page.keyboard.down('Space');await page.waitForTimeout(500);await page.keyboard.up('Space');
 assert.equal(await page.evaluate(()=>__tron.state.extraShots),0);
 await page.keyboard.press('Escape');const before=await page.evaluate(()=>__tron.state.extraShots);
 await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>__tron.state.extraShots),before);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.extraShots===3);
 console.log('Space presses spend banked extras; held fire uses normal recharge; pausing stops refill.');
}finally{await browser.close();}
