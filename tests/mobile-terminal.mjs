import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const profile of [devices['iPhone 13'],devices['iPad Pro 11'],devices['Pixel 7']]){
  const page=await browser.newPage(profile),requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('http://localhost:5173/');
  await page.locator('body.mobile-terminal').waitFor({state:'attached'});
  await page.locator('#loading h1').waitFor();
  assert.equal(await page.locator('#loading h1').innerText(),'MOBILE TERMINALS NOT SUPPORTED');
  assert.equal(await page.locator('#intro').isVisible(),false);
  assert(!requests.some(url=>/game-app\.js|\.glb(?:\?|$)/.test(url)));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();
 }
 const desktop=await browser.newPage({viewport:{width:600,height:800}});
 await desktop.goto('http://localhost:5173/');
 await desktop.locator('#intro:not([hidden])').waitFor({timeout:60000});
 assert.equal(await desktop.locator('body.mobile-terminal').count(),0);
 console.log('Phones/tablet show readable warning without loading game; narrow desktop retains menu.');
}finally{await browser.close();}
