import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://127.0.0.1:5173/?layoutSeed=1982&cycleStart=1');
 await page.waitForFunction(()=>{try{return __tron.state.playerVehicle==='cycle'&&__tron.state.cycleRendering?.visible;}catch{return false;}},{},{timeout:60000});
 await page.evaluate(()=>{
  const r=__tron.state,race=r.cycleRace,b=race.cycles[race.playerId];
  Object.assign(b,{escaped:true,x:0,z:-98,previousX:0,previousZ:-98,yaw:Math.PI,roadSpeed:20,targetRoadSpeed:20,steering:0,lean:0});
  race.phase='racing';race.arenaPaused=true;
  __tron.place({cycleRace:race,recognizers:[],enemyTanks:[],projectiles:[]});
 });
 await page.keyboard.press('KeyW');
 await page.waitForFunction(()=>!__tron.state.cycleRace.cycles[1].escaped,{},{timeout:15000});
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.arenaPaused),false);
 await page.keyboard.press('KeyA');
 await page.waitForFunction(()=>__tron.state.cycleRace.cycles[1].dir===1);
 await page.keyboard.down('KeyW');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.cycles[1].boosting),true);
 await page.keyboard.down('KeyS');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.cycles[1].boosting),false);
 await page.keyboard.up('KeyW');await page.keyboard.up('KeyS');
 await page.keyboard.down('KeyX');await page.waitForTimeout(500);
 const braking=await page.evaluate(()=>__tron.state.cycleRace.cycles[1]);
 assert(braking.alive&&!braking.escaped&&!braking.reverseGear);
 assert(braking.speedMultiplier>=.5&&braking.speedMultiplier<.51);
 await page.keyboard.up('KeyX');
 const state=await page.evaluate(()=>__tron.state);
 assert(state.cycleRace.cycles[1].alive);
 assert(state.cycleRace.trails.some(t=>t.bikeId===1&&t.startsRun));
 assert(state.cycleRendering.trailCounts.some(n=>n>0));
 await page.screenshot({path:'test-results/cycle-reentry.png'});
 assert.deepEqual(errors,[]);console.log('Chrome: breach reentry, arcade turn, turbo, S/X slowing without destruction, and rendered trails passed.');
}finally{await browser.close();}
