import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Observer mode marks the followed cycle's roster circle with a downward triangle.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:60000});
 const marked=()=>page.locator('.cycle-roster-icon.observed').evaluateAll(icons=>icons.map(i=>i.dataset.cycleId+':'+!!i.querySelector('.cycle-roster-observed')));
 assert.deepEqual(await marked(),[],'no triangle while playing');
 await page.evaluate(()=>{
  const r=__tron.state.cycleRace;r.arenaPaused=true;
  for(const b of r.cycles)Object.assign(b,{alive:b.id!==r.playerId,x:b.id*10,previousX:b.id*10,z:0,previousZ:0,progress:1,dir:0});
  __tron.place({cycleRace:r});
 });
 await page.waitForFunction(()=>__tron.state.cycleSpectating);
 for(const key of ['ArrowRight','ArrowRight','ArrowLeft']){
  await page.keyboard.press(key);
  await page.waitForFunction(()=>__tron.state.cycleFollowId!==null);
  await page.waitForTimeout(200);
  const id=await page.evaluate(()=>__tron.state.cycleFollowId);
  assert.deepEqual(await marked(),[`${id}:true`],'triangle marks the followed cycle');
 }
 const box=await page.locator('.cycle-roster-observed').boundingBox(),circle=await page.locator('.cycle-roster-icon.observed').boundingBox();
 assert(box.y+box.height<=circle.y,'triangle sits above its circle');
 assert(Math.abs(box.x+box.width/2-(circle.x+circle.width/2))<1,'triangle is centered on its circle');
 await page.screenshot({path:'test-results/cycle-roster-observed.png',clip:{x:440,y:0,width:400,height:70}});
 assert.deepEqual(errors,[]);console.log('Observer roster triangle follows the watched cycle.');
}finally{await browser.close();}
