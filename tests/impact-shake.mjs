import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__tron);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('playing'));
 await page.keyboard.press('Escape');
 async function sample(impact,time=3){
  await page.evaluate(({impact,time})=>window.__tron.place({x:-5000,s:-5000,yaw:0,turretYaw:0,aimPitch:0,gunner:true,speed:0,impact,time,recognizers:[],enemyTanks:[]}),{impact,time});
  await page.waitForTimeout(80);
  return page.evaluate(()=>({point:window.__tron.project({x:-5000,s:-4900,y:3}),aim:window.__tron.state.aimPitch}));
 }
 const steady=await sample(0),hit=await sample(1),paused=await page.evaluate(()=>window.__tron.project({x:-5000,s:-4900,y:3}));
 assert(Math.hypot(steady.point.x-hit.point.x,steady.point.y-hit.point.y)>.005);
 assert.deepEqual(hit.point,paused);assert.equal(hit.aim,0);
 const next=await sample(1,3.05);assert.notDeepEqual(hit.point,next.point);
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await sample(1);assert.deepEqual(reduced.point,steady.point);
 console.log('Impact camera vibration moves the rendered view, freezes on pause, preserves aim, and respects reduced motion.');
}finally{await browser.close();}
