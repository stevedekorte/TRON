import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Actual game: the arena announcer speaks at 200% to the rider and at 300% after the rider becomes an observer.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 await page.waitForFunction(()=>__tron.state.cycleSpeedVoice?.level===0);
 const jump=elapsed=>page.evaluate(t=>{const r=__tron.state.cycleRace;r.elapsed=t;r.occupied.fill(0);r.trails=[];for(const b of r.cycles)b.segment=-1;__tron.place({cycleRace:r});},elapsed);
 await jump(99.5);
 await page.waitForFunction(()=>__tron.state.cycleSpeedVoice.playing&&__tron.state.cycleSpeedVoice.sample==='200',null,{timeout:10000});
 await page.waitForFunction(()=>!__tron.state.cycleSpeedVoice.playing,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>__tron.state.cycleSpeedVoice.level),1);
 // The player is now an observer; the announcer still speaks.
 await page.evaluate(()=>{const r=__tron.state.cycleRace;r.cycles[r.playerId].alive=false;__tron.place({cycleRace:r});});
 await page.waitForFunction(()=>__tron.state.cycleSpectating);
 await jump(199.5);
 await page.waitForFunction(()=>__tron.state.cycleSpeedVoice.playing&&__tron.state.cycleSpeedVoice.sample==='300',null,{timeout:10000});
 assert.deepEqual(errors,[]);console.log('Arena speed announcer played the 200% clip to the player and the 300% clip to an observer.');
}finally{await browser.close();}
