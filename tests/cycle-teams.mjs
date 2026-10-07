import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/?cycleStart=1&layoutSeed=1982');
 await page.waitForFunction(()=>window.tronLoadingReport?.().includes('Player entered cycle arena'),null,{timeout:120000});
 await page.waitForFunction(()=>window.__tron?.state.playerVehicle==='cycle',null,{timeout:120000});
 for(const count of [3,1,2]){
  await page.evaluate(async count=>{
   const {resetCycleRound,updateCycleRace}=await import('/src/simulation/light-cycles.js');
   const r=__tron.state.cycleRace;Object.assign(r,{teamCount:4,cyclesPerTeam:count,startOutside:false,hideMiddleOpponent:false,startWithBreach:false,entranceFormation:true,playerId:0});resetCycleRound(r);r.remaining=0;updateCycleRace(r,1/120);r.arenaPaused=true;
   __tron.place({cycleRace:r});
  },count);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>__tron.state.cycleRace.cycles.length),4*count);
  await page.screenshot({path:`test-results/cycle-four-teams-${count}.png`});
 }
 for(const winner of [2,3]){
  await page.evaluate(winner=>{const r=__tron.state.cycleRace;r.arenaPaused=false;r.phase='result';r.winner=winner;__tron.place({cycleRace:r});},winner);
  await page.waitForTimeout(500);assert.equal(await page.locator('#cycle-result').innerText(),`${winner===2?'RED':'GREEN'} TEAM WINS`);
 }
 assert.deepEqual(errors,[]);console.log('Four-team rosters at every size and red/green winner screens render without errors.');
}finally{await browser.close();}
