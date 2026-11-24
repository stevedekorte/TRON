import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 let release;const held=new Promise(r=>release=r);let requested=false;
 await page.route('**/src/rendering/pov-cycles.js*',async r=>{requested=true;await held;await r.continue();});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 await page.locator('#start-multiplayer').click();
 await page.waitForFunction(()=>__tron.state.multiplayer&&__tron.state.mode==='running',null,{timeout:60000});
 // The round never waits for a client: a slow detailed renderer does not hold the launch.
 const started=Date.now();
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing',null,{timeout:10000});
 const launchedAfter=(Date.now()-started)/1000;assert(requested,'detailed renderer request held');
 assert(launchedAfter<4,`launched ${launchedAfter.toFixed(1)} s after entering`);
 release();await page.waitForFunction(()=>__tron.state.cycleRendererMode==='pov',null,{timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('#home-transition'),null,{timeout:10000});
 await page.screenshot({path:'test-results/mp-first-materialization.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({delayedRendererMs:'until launch',launchedAfter,renderer:'pov',errors}));
}finally{await browser.close();}
