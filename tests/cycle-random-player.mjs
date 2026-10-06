import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/?runSeed=1982');await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 const ids=[];
 for(let i=0;i<15;i++){
  const state=await page.evaluate(()=>{const r=__tron.state.cycleRace;return {id:r.playerId,team:r.cycles[r.playerId].team,round:r.round};});ids.push(state.id);assert.equal(state.team,0);
  await page.evaluate(()=>{const r=__tron.state.cycleRace;r.phase='result';r.winner=0;r.remaining=6;__tron.place({cycleRace:r});});
  await page.keyboard.press('Enter');await page.waitForFunction(round=>__tron.state.cycleRace.round>round,state.round);
 }
 assert.deepEqual(new Set(ids),new Set([0,1,2]));assert.deepEqual(errors,[]);console.log({ids});
}finally{await browser.close();}
