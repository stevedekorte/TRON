import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// One player's tab goes to the background (hidden, no animation frames). The next round
// must still start promptly for the other player, and the background player stays connected.
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
 const [front,back]=pages;
 await back.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
  window.requestAnimationFrame=()=>0;document.dispatchEvent(new Event('visibilitychange'));
 });
 // Idle riders crash on their own; then the front player restarts.
 const round=await front.evaluate(()=>__tron.state.cycleRace.round);
 for(let i=0;i<120&&await front.evaluate(r=>__tron.state.cycleRace.round===r,round);i++){await front.keyboard.press('Enter');await front.waitForTimeout(1000);}
 assert(await front.evaluate(r=>__tron.state.cycleRace.round>r,round),'next round began');
 const staged=Date.now();
 await front.waitForFunction(()=>!__tron.state.cycleRace.cameraStaging,null,{timeout:30000});
 const waited=(Date.now()-staged)/1000;
 assert(waited<8,`round staging waited ${waited.toFixed(1)} s for the background tab`);
 const backConnected=await back.evaluate(()=>!document.querySelector('#error:not([hidden])'));
 assert(backConnected,'background player was not disconnected');
 assert.deepEqual(errors,[]);console.log(`Next round started ${waited.toFixed(1)} s after staging with one tab in the background; both players connected.`);
}finally{await browser.close();}
