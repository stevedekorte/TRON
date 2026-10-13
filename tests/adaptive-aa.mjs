import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({json:{actions:[]}}));
 await page.goto('http://127.0.0.1:5173/?layoutSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,{},{timeout:120000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('playing'),{},{timeout:60000});
 const initial=await page.evaluate(()=>__tron.state.renderer);
 // Accelerate the controller's observation windows, not the game simulation.
 await page.evaluate(async()=>{const {ADAPTIVE_AA}=await import('/src/rendering/adaptive-aa.js');Object.assign(ADAPTIVE_AA,{windowSeconds:.2,settleSeconds:0,upgradeSeconds:1});__tron.configure({targetFps:1000});});
 await page.waitForFunction(()=>__tron.state.renderer.adaptiveAA.level===0,{},{timeout:60000});
 const low=await page.evaluate(()=>__tron.state.renderer);
 assert.equal(low.samples,0);assert.equal(low.smaa,true);assert.equal(low.pixelRatio,.85);
 await page.evaluate(()=>__tron.configure({targetFps:30}));
 await page.waitForTimeout(3000);
 const settled=await page.evaluate(()=>__tron.state.renderer);
 assert.equal(settled.adaptiveAA.level,0);assert.equal(settled.adaptiveAA.ceiling,0);
 assert(settled.textures<=initial.textures+4,'framebuffer changes do not accumulate textures');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/adaptive-aa.png'});
 console.log('Real renderer: supported MSAA, resolution fallback, SMAA retained, stable ceiling and no JS errors.',{initial,settled});
}finally{await browser.close();}
