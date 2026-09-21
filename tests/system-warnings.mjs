import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 let healthy=false;
 await page.route('**/api/jev/decision',route=>{
  const state=route.request().postDataJSON();return route.fulfill({status:healthy?200:503,contentType:'application/json',body:JSON.stringify(healthy?{id:state.options[0].id,confidence:0}:{error:'AI service unavailable'})});
 });
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#system-warnings').textContent.includes('JEV UNAVAILABLE'));
 const notice=page.locator('#system-warnings');assert(await notice.isVisible());
 await page.keyboard.press('Escape');assert(await notice.isVisible());
 await page.screenshot({path:'test-results/system-warning.png'});
 await page.keyboard.press('Shift+T');await page.selectOption('#enemy-ai','classic');await page.click('#apply-ai');
 await page.waitForFunction(()=>document.querySelector('#system-warnings').textContent.includes('JEV OFF'));
 healthy=true;await page.selectOption('#enemy-ai','jev');await page.click('#apply-ai');
 await page.waitForFunction(()=>__tron.state.aiHistory.length>0&&document.querySelector('#system-warnings').hidden);
 assert.deepEqual(errors,[]);console.log('HUD warning: outage, pause, disabled mode and successful recovery passed; no paid calls.');
}finally{await browser.close();}
