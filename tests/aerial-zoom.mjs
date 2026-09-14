import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='running');
 await page.keyboard.press('KeyV');await page.keyboard.press('Escape');await page.mouse.move(700,500);
 await page.mouse.wheel(0,1200);await page.mouse.wheel(0,1200);
 await page.waitForFunction(()=>window.__tron.state.camera.y>2300);
 assert.equal(await page.evaluate(()=>window.__tron.state.aerialZoom),4);
 await page.screenshot({path:'test-results/aerial-zoom-out.png'});
 for(let i=0;i<4;i++)await page.mouse.wheel(0,-1200);
 await page.waitForFunction(()=>window.__tron.state.camera.y<160);
 assert.equal(await page.evaluate(()=>window.__tron.state.aerialZoom),.25);
 await page.keyboard.press('Enter');await page.keyboard.press('KeyV');await page.mouse.wheel(0,1200);
 assert.equal(await page.evaluate(()=>window.__tron.state.aerialZoom),.25);
 await page.keyboard.press('KeyV');assert.equal(await page.evaluate(()=>window.__tron.state.aerialZoom),.25);
 assert.deepEqual(errors,[]);console.log('Aerial wheel zoom spans 150–2400 m, works paused, remembers zoom, and leaves driving view unchanged.');
}finally{await browser.close();}
