import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),afterStart=[],errors=[];
 let started=false;
 page.on('request',r=>{if(started&&/\.glb(?:\?|$)/.test(r.url()))afterStart.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>window.tronLoadingReport?.().includes('Opening terminal ready'),{},{timeout:120000});
 const report=await page.evaluate(()=>tronLoadingReport());
 assert(report.includes('Arena assets ready'));
 assert(report.indexOf('Arena assets ready')<report.indexOf('Opening terminal ready'));
 await page.locator('#start-cycles').focus();
 started=true;await page.keyboard.press('Enter');
 await page.waitForFunction(()=>{try{return __tron.state.playerVehicle==='cycle';}catch{return false;}},{},{timeout:30000});
 assert.deepEqual(afterStart,[],'No GLB downloads should begin after selecting cycles');
 assert.deepEqual(errors,[]);
 console.log(report);console.log('Cycle arena ready before menu; no model downloads on Return.');
}finally{await browser.close();}
