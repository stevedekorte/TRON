// A lost WebGL context during POV-Ray cycles falls back to the normal renderer
// and play continues after the browser restores it; a context that stays lost
// ends in the error screen; reloads after a POV loss start normal.
import {chromium} from '@playwright/test';
import {silentChromeArgs,silence} from './silent.mjs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const URL='http://127.0.0.1:5173/?layoutSeed=1982&cycleStart=0';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true,args:silentChromeArgs});
async function litFraction(page,path){
 const {data,info}=await sharp(await page.screenshot({path})).raw().toBuffer({resolveWithObject:true});
 let lit=0;for(let i=0;i<data.length;i+=info.channels)if(data[i]+data[i+1]+data[i+2]>60)lit++;
 return lit/(info.width*info.height);
}
async function enterArena(page){
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,json:{error:'Test unavailable'}}));
 await page.goto(URL);
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,{},{timeout:120000});
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__tron?.state.playerVehicle==='cycle'&&__tron.state.cycleRace.phase==='racing',{},{timeout:120000});
}
try{
 const context=await browser.newContext({viewport:{width:1280,height:720}});await silence(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enterArena(page);
 await page.waitForFunction(()=>__tron.state.cycleRendererMode==='pov'&&__tron.state.csgCycleCount>0,{},{timeout:60000});
 await page.evaluate(()=>{window.loseExt=document.querySelector('#game').getContext('webgl2').getExtension('WEBGL_lose_context');loseExt.loseContext();});
 await page.waitForTimeout(500);
 let state=await page.evaluate(()=>({mode:__tron.state.mode,renderer:__tron.state.cycleRendererMode,flag:localStorage.getItem('tron.povCycleContextLoss')}));
 assert.notEqual(state.mode,'error','a lost context waits for restoration');
 assert.equal(state.renderer,'normal','POV-Ray is dropped on loss');
 assert(state.flag,'the POV failure is remembered');
 const raceTime=await page.evaluate(()=>__tron.state.time);
 await page.evaluate(()=>loseExt.restoreContext());
 await page.waitForTimeout(1500);
 state=await page.evaluate(()=>({mode:__tron.state.mode,renderer:__tron.state.cycleRendererMode,csg:__tron.state.csgCycleCount,time:__tron.state.time,lost:document.querySelector('#game').getContext('webgl2').isContextLost()}));
 assert.equal(state.lost,false);assert.notEqual(state.mode,'error');assert.equal(state.renderer,'normal');assert.equal(state.csg,0);
 assert(state.time>raceTime,'the game keeps running');
 const lit=await litFraction(page,'test-results/startup/context-restore/context-restored.png');
 assert(lit>.02,`the restored scene renders (${(lit*100).toFixed(1)}% lit)`);
 console.log(`Restored: POV dropped, normal renderer drawing ${(lit*100).toFixed(1)}% lit pixels.`);

 // Never restored: the page reloads itself once, to the terminal with the same
 // program selected; a second unrestored loss within the guard shows the error.
 const selected=await page.evaluate(()=>document.querySelector('#game-menu [aria-pressed="true"]').dataset.game);
 await page.evaluate(()=>loseExt.loseContext());
 await page.waitForEvent('load',{timeout:20000});
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,{},{timeout:120000});
 assert.equal(await page.evaluate(()=>document.querySelector('#game-menu [aria-pressed="true"]').dataset.game),selected,'same program selected after the reload');
 console.log(`Unrestored loss reloads to the terminal with ${selected} selected.`);
 await page.evaluate(()=>document.querySelector('#game').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await page.waitForFunction(()=>/interrupted/i.test(document.querySelector('#error-message')?.textContent??''),{},{timeout:15000});
 console.log('A repeated unrestored loss within the guard shows the reconnect message.');
 await page.close();

 // The remembered failure keeps the next load on normal cycles, without CSG.
 const reload=await context.newPage(),requests=[];reload.on('request',r=>requests.push(r.url()));
 await enterArena(reload);await reload.waitForTimeout(3000);
 assert.equal(await reload.evaluate(()=>__tron.state.cycleRendererMode),'normal');
 assert(!requests.some(u=>u.includes('/pov-cycles.js')),'no CSG module after a remembered loss');
 assert.deepEqual(errors,[]);
 console.log('Reload after a POV loss stays on normal cycles.');
 await context.close();
}finally{await browser.close();}
