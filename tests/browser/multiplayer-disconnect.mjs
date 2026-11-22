import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// A player who closes the page mid-round: their cycle rides on, the arena never waits,
// and they are dropped from the player list once the round ends.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const errors=[],pages=[];
 for(let i=0;i<2;i++){
  const page=await browser.newPage({viewport:{width:900,height:600}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
  await page.locator('#start-multiplayer').click();
  await page.waitForFunction(()=>__tron.state.multiplayer&&__tron.state.mode==='running',null,{timeout:60000});
  pages.push(page);
 }
 const [stay,leave]=pages;
 // A late joiner waits in the queue; cycle rounds until both players hold seats in a live race.
 for(let i=0;i<180;i++){
  const ready=await leave.evaluate(()=>__tron.state.multiplayer.seat!==null&&__tron.state.cycleRace.phase==='racing'&&__tron.state.cycleRace.cycles[__tron.state.multiplayer.seat].alive);
  if(ready)break;await stay.keyboard.press('Enter');await stay.waitForTimeout(1000);
 }
 const seat=await leave.evaluate(()=>__tron.state.multiplayer.seat);assert.notEqual(seat,null);
 const round=await stay.evaluate(()=>__tron.state.cycleRace.round);
 const before=await stay.evaluate(s=>{const b=__tron.state.cycleRace.cycles[s];return {alive:b.alive,x:b.x,z:b.z};},seat);
 assert(before.alive,'leaving rider alive before disconnect');
 await leave.close();
 await stay.waitForTimeout(1500);
 const after=await stay.evaluate(s=>{const b=__tron.state.cycleRace.cycles[s];return {alive:b.alive,x:b.x,z:b.z,phase:__tron.state.cycleRace.phase,players:__tron.state.multiplayer.players};},seat);
 assert(after.alive||after.x!==before.x||after.z!==before.z,'disconnected cycle was not derezzed on the spot');
 assert(after.x!==before.x||after.z!==before.z,'disconnected cycle keeps moving');
 assert.equal(after.players,2,'still listed until the round ends');
 // Remaining player restarts once its own rider is down; the unattended cycle never blocks it.
 for(let i=0;i<120&&await stay.evaluate(r=>__tron.state.cycleRace.round===r,round);i++){await stay.keyboard.press('Enter');await stay.waitForTimeout(1000);}
 await stay.waitForFunction(r=>__tron.state.cycleRace.round>r,round,{timeout:5000});
 await stay.waitForFunction(()=>__tron.state.multiplayer.players===1,null,{timeout:5000});
 assert.deepEqual(errors,[]);
 console.log(`Disconnected rider moved ${Math.hypot(after.x-before.x,after.z-before.z).toFixed(1)} cells in 1.5 s, alive=${after.alive}; removed when round ${round+1} began.`);
}finally{await browser.close();}
