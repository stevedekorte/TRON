import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/decision',route=>{
  const snapshot=route.request().postDataJSON();requests.push(snapshot);
  return route.fulfill({json:{id:snapshot.options[0].id,confidence:1}});
 });
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.aiHistory.some(h=>h.request.controller==='cycle'&&h.accepted),null,{timeout:60000});
 assert(requests.some(r=>r.controller==='cycle'));
 assert(requests.filter(r=>r.controller==='cycle').every(r=>r.self.id!==1));
 await page.keyboard.press('Escape');
 await page.waitForTimeout(100);const count=requests.length;
 await page.waitForTimeout(1500);assert.equal(requests.length,count);
 await page.screenshot({path:'test-results/cycle-jev.png'});
 assert.deepEqual(errors,[]);
 console.log('Cycle JEV: arena requests, accepted decisions, human exclusion and paused scheduling passed.');
}finally{await browser.close();}
