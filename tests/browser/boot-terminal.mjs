import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL??'http://127.0.0.1:5188/');
 await page.waitForFunction(()=>window.tronLoadingReport?.().includes('Frame callback after opening ready'),null,{timeout:120000});
 const lines=await page.locator('#boot-status').textContent();
 assert(!/\d+\s*ms|WebGL|shader|fetch|decode/i.test(lines));
 const report=await page.evaluate(()=>tronLoadingReport());assert.match(report,/Times in ms/);
 await page.evaluate(async()=>{
  window.boot=await import('/src/loading/boot-terminal.js');
  window.previousBootStatus=document.querySelector('#boot-status').textContent;
  boot.beginBootStage('Carrier model (fetch, decode, adapt)');
  boot.printBootLine('Carrier model (fetch, decode, adapt)',499);
 });
 assert.equal(await page.locator('#boot-lines').count(),0);
 assert.equal(await page.locator('#boot-status').textContent(),await page.evaluate(()=>previousBootStatus));
 await page.evaluate(()=>boot.beginBootStage('Initial simulation / enemy placement'));
 await page.waitForFunction(()=>document.querySelector('#boot-status').textContent==='ASSIGNING SECURITY PROGRAMS');
 await page.evaluate(()=>boot.printBootLine('Initial simulation / enemy placement',500));
 assert.equal(await page.locator('#boot-status').textContent(),'SECURITY PROGRAMS ASSIGNED');
 await page.evaluate(()=>{boot.beginBootStage('Carrier model (fetch, decode, adapt)');boot.printBootLine('Carrier model (fetch, decode, adapt)',700);});
 assert.equal(await page.locator('#boot-status').textContent(),'CARRIER RECORDS LOADED');
 await page.evaluate(()=>{document.querySelector('#intro').hidden=true;document.querySelector('#loading').hidden=false;});
 await page.screenshot({path:'test-results/boot-terminal.png'});
 assert.deepEqual(errors,[]);console.log('Single-line replacement and 500 ms threshold verified; console report retained.');
}finally{await browser.close();}
