import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 for(const winner of [0,1,null]){
  await page.evaluate(winner=>{const r=__tron.state.cycleRace;r.phase='result';r.winner=winner;r.round++;r.arenaPaused=false;
   for(const b of r.cycles)Object.assign(b,{alive:winner!=null&&b.team===winner&&b.id!==r.playerId,x:b.id*4,previousX:b.id*4,z:0,previousZ:0,dir:0});
   r.crashes=[{id:r.playerId,time:r.time,x:r.cycles[r.playerId].x,z:0,team:0,dir:0}];__tron.place({cycleRace:r,cycleFollowId:0});},winner);
  await page.waitForTimeout(3200);
  console.log(await page.evaluate(()=>({phase:__tron.state.cycleRace.phase,vehicle:__tron.state.playerVehicle,mode:__tron.state.mode,text:document.querySelector('#cycle-result').textContent,hidden:document.querySelector('#cycle-result').hidden})),errors);
  assert.equal(await page.locator('#cycle-result').innerText(),winner==null?'TIED MATCH!':`${winner===0?'GOLD':'BLUE'} TEAM WINS`);
  await page.screenshot({path:`test-results/cycle-result-${winner}.png`});
 }
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#cycle-result').hidden);
 assert.deepEqual(errors,[]);console.log('Gold, blue and tie result orbits render; Enter restarts and clears result.');
}finally{await browser.close();}
