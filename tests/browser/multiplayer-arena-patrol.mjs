import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Multiplayer clients fly the arena guard locally; the server does not simulate Recognizers.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 await page.locator('#start-multiplayer').click();
 await page.waitForFunction(()=>__tron.state.multiplayer&&__tron.state.mode==='running',null,{timeout:60000});
 const guard=()=>page.evaluate(()=>{const e=__tron.state.recognizers.find(e=>e.role==='arena-patrol');return e&&{x:e.x,s:e.s,y:e.y};});
 const start=await guard();assert(start,'arena guard exists');
 await page.waitForTimeout(5000);
 const end=await guard(),moved=Math.hypot(end.x-start.x,end.s-start.s);
 assert(moved>40,`arena guard moved ${moved.toFixed(1)} m in 5 s`);
 assert.deepEqual(errors,[]);console.log(`Multiplayer arena guard moved ${moved.toFixed(1)} m in 5 s.`);
}finally{await browser.close();}
