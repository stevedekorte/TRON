import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.showSaveFilePicker=options=>{window.__saveOptions=options;return new Promise((resolve,reject)=>{window.__cancel=()=>reject(new DOMException('Cancelled','AbortError'));window.__save=()=>resolve({createWritable:async()=>({write:async blob=>{window.__saved=blob;},close:async()=>{window.__closed=true;}})});});};});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('Escape');
 await page.keyboard.press('KeyB');assert.equal(await page.locator('#hud').evaluate(e=>getComputedStyle(e).visibility),'hidden');assert.equal(await page.evaluate(()=>__tron.state.mode),'paused');
 await page.evaluate(()=>__save());await page.waitForFunction(()=>__closed&&!document.body.classList.contains('taking-screenshot'));
 const saved=await page.evaluate(async()=>{const bitmap=await createImageBitmap(__saved),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let lit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>50)lit++;return {type:__saved.type,size:__saved.size,width:c.width,height:c.height,lit,name:__saveOptions.suggestedName};});
 assert.equal(saved.type,'image/png');assert.ok(saved.size>10000);assert.ok(saved.lit>10000);assert.ok(saved.width>=1000);assert.match(saved.name,/^Space-Paranoids-.*\.png$/);
 await page.keyboard.press('F9');await page.evaluate(()=>__cancel());await page.waitForFunction(()=>!document.body.classList.contains('taking-screenshot'));assert.equal(await page.evaluate(()=>__tron.state.mode),'paused');
 await page.evaluate(()=>window.showSaveFilePicker=undefined);const download=page.waitForEvent('download');await page.keyboard.press('KeyB');assert.match((await download).suggestedFilename(),/^Space-Paranoids-.*\.png$/);await page.waitForFunction(()=>!document.body.classList.contains('taking-screenshot'));assert.match(await page.locator('#screenshot-status').textContent(),/DOWNLOADS/);assert.deepEqual(errors,[]);console.log(saved);
}finally{await browser.close();}
