import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>window.__tron?.state.mode==='ready');
 const start=await page.evaluate(()=>window.__tron.state);
 assert.equal(start.recognizers.length,3);assert.equal(start.audioSources,0);
 assert.ok(start.recognizers.slice(2).every(e=>e.state==='wander'&&!e.memory));
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__tron.state.mode==='running');
 await page.waitForTimeout(1500);await page.keyboard.press('Escape');
 const after=await page.evaluate(()=>window.__tron.state);
 assert.ok(after.recognizers.slice(2).every((e,i)=>Math.hypot(e.x-start.recognizers[i+2].x,e.s-start.recognizers[i+2].s)>1));
 await page.waitForTimeout(200);assert.deepEqual((await page.evaluate(()=>window.__tron.state)).recognizers,after.recognizers);
 assert.deepEqual(errors,[]);console.log('Three aircraft/audio voices loaded; one unalerted patrol move autonomously and freeze on pause.');
}finally{await browser.close();}
