import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Actual game: arena-wide derez cues play for a far-off teammate's and an opponent's loss, not for the rider's own.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 const ids=await page.evaluate(()=>{const r=__tron.state.cycleRace,me=r.cycles[r.playerId];r.arenaPaused=true;__tron.place({cycleRace:r});
  return {me:me.id,mate:r.cycles.find(b=>b.team===me.team&&b.id!==me.id&&b.alive)?.id,foe:r.cycles.find(b=>b.team!==me.team&&b.alive).id};});
 await page.waitForFunction(()=>__tron.state.cycleLossCue);
 const played=()=>page.evaluate(()=>__tron.state.cycleLossCue.played);
 const kill=id=>page.evaluate(id=>{const r=__tron.state.cycleRace,b=r.cycles[id];b.alive=false;r.crashes.push({id,x:b.x,z:b.z,team:b.team,dir:b.dir,time:r.time});__tron.place({cycleRace:r});},id);
 const before=await played();
 await kill(ids.foe);await page.waitForFunction(n=>__tron.state.cycleLossCue.played===n,before+1);
 if(ids.mate!==undefined){await kill(ids.mate);await page.waitForFunction(n=>__tron.state.cycleLossCue.played===n,before+2);}
 const n=await played();await kill(ids.me);await page.waitForTimeout(400);assert.equal(await played(),n,'own crash plays no cue');
 assert.deepEqual(errors,[]);console.log('Loss cues played:',n-before,ids);
}finally{await browser.close();}
