import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Actual game: "One opponent left" plays once when the solo player's living opponents drop to one.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 const enemies=await page.evaluate(()=>{const r=__tron.state.cycleRace,me=r.cycles[r.playerId];r.arenaPaused=true;__tron.place({cycleRace:r});return r.cycles.filter(b=>b.team!==me.team).map(b=>b.id);});
 assert(enemies.length>=2,'needs at least two opponents');
 await page.waitForFunction(n=>__tron.state.cycleOpponentVoice?.count===n,enemies.length);
 const kill=ids=>page.evaluate(ids=>{const r=__tron.state.cycleRace;for(const id of ids)r.cycles[id].alive=false;__tron.place({cycleRace:r});},ids);
 await kill(enemies.slice(0,-2));await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>__tron.state.cycleOpponentVoice.playing),false);
 await kill([enemies.at(-2)]);
 await page.waitForFunction(()=>__tron.state.cycleOpponentVoice.playing,null,{timeout:10000});
 await page.waitForFunction(()=>!__tron.state.cycleOpponentVoice.playing,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>__tron.state.cycleOpponentVoice.done),true);
 assert.deepEqual(errors,[]);console.log(`One opponent left played once after ${enemies.length-1} of ${enemies.length} opponents fell.`);
}finally{await browser.close();}
