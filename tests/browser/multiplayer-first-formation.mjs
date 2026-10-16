import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 let release;const held=new Promise(r=>release=r);let requested=false;
 await page.route('**/src/rendering/pov-cycles.js*',async r=>{requested=true;await held;await r.continue();});
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 await page.locator('#start-multiplayer').click();
 await page.waitForFunction(()=>__tron.state.multiplayer&&__tron.state.mode==='running',null,{timeout:60000});
 await page.waitForTimeout(6000);assert(requested,'detailed renderer request held');
 assert(await page.evaluate(()=>__tron.state.cycleRace.cameraStaging),'first round waits beyond camera travel while renderer loads');
 assert.equal(await page.evaluate(()=>__tron.state.cycleRendering.bikes.some(b=>b.visible)),false);
 release();await page.waitForFunction(()=>__tron.state.cycleRace.materializing,null,{timeout:60000});
 assert.equal(await page.evaluate(()=>__tron.state.cycleRendererMode),'pov');
 assert.equal(await page.locator('#home-transition').count(),0);
 const initial=await page.evaluate(()=>__tron.state.cycleRace.remaining);assert(initial>1.7,'full animation remains when renderer is ready');
 await page.waitForTimeout(450);await page.screenshot({path:'test-results/mp-first-materialization.png'});
 assert(await page.evaluate(()=>__tron.state.cycleRace.materializing),'animation stays visible');
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({delayedRendererMs:6000,initialRemaining:initial,renderer:'pov',racing:true,errors}));
}finally{await browser.close();}
