import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 const distances=[];
 for(const speed of [1,2.5,.5]){
  await page.evaluate(speed=>{const r=__tron.state.cycleRace;r.arenaPaused=true;r.crashes=[];
   for(const b of r.cycles)Object.assign(b,{alive:true,escaped:false,continuousArena:true,x:b.id*8,z:0,previousX:b.id*8,previousZ:0,progress:1,dir:0,speedMultiplier:speed});
   __tron.place({cycleRace:r});},speed);
  await page.waitForTimeout(3500);
  distances.push(await page.evaluate(()=>{const s=__tron.state,r=s.cycleRace,b=r.cycles[r.playerId];return Math.hypot(s.camera.x-r.site.x-b.x*4.8,s.camera.z+r.site.s-b.z*4.8);}));
  await page.screenshot({path:`test-results/cycle-speed-${speed}.png`});
 }
 assert(distances[1]<distances[0]-2);assert(distances[2]>distances[0]+.7);assert.deepEqual(errors,[]);console.log({distances});
}finally{await browser.close();}
