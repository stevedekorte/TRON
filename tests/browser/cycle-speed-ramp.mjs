import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL??'http://127.0.0.1:5188/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle'&&__tron.state.cycleOpening===null&&__tron.state.cycleRace.phase==='racing',null,{timeout:60000});
 await page.evaluate(async()=>{
  const {resetCycleRound}=await import('/shared/simulation/light-cycles.js');
  const race=__tron.state.cycleRace;resetCycleRound(race);race.phase='racing';race.elapsed=12;race.occupied.fill(0);race.trails=[];
  for(const b of race.cycles)Object.assign(b,{x:b.id*10,previousX:b.id*10,z:0,previousZ:0,dir:0,nextReactionAt:Infinity,aiController:'classic'});
  __tron.place({cycleRace:race,crushed:false,won:false});
 });
 const notice=page.locator('#cycle-speed-notice');
 await page.waitForFunction(()=>document.querySelector('#cycle-speed-notice').textContent==='GRID SPEED: 112%');assert(await notice.isVisible());
 await page.waitForFunction(()=>document.querySelector('#cycle-speed-notice').textContent==='GRID SPEED: 113%');assert(await notice.isVisible());
 await page.screenshot({path:'test-results/cycle-speed-ramp.png'});
 await page.waitForFunction(()=>__tron.state.cycleRace.cycles[__tron.state.cycleRace.playerId].speedMultiplier>=1.13);
 assert.deepEqual(errors,[]);console.log('Solo HUD stays visible as speed rises by one percentage point per second, without page errors.');
}finally{await browser.close();}
