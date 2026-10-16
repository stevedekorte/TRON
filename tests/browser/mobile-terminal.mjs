import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const name of ['iPhone 13','iPad Pro 11','Pixel 7']){
  const page=await browser.newPage({...devices[name],reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TRON_URL??'http://127.0.0.1:5188/');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-credits').disabled);
  assert(await page.locator('#start').isDisabled());
  assert.equal(await page.locator('#clu-mobile-note').innerText(),'(UNAVAILABLE ON MOBILE)');
  assert.equal(await page.locator('#game-menu button:enabled').count(),5);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#start-cycles').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#start-bit').getAttribute('aria-pressed'),'true','keyboard skips CLU');
  await page.locator('#start').dispatchEvent('click');assert.equal(await page.evaluate(()=>__tron.state.mode),'ready');
  await page.screenshot({path:'test-results/mobile-menu-'+name.replaceAll(' ','-')+'.png'});
  await page.locator('#start-credits').tap();
  await page.waitForFunction(()=>document.body.classList.contains('victory-credits')&&!document.body.classList.contains('home-opening'));
  await page.touchscreen.tap(15,15);
  await page.waitForFunction(()=>__tron.state.mode==='ready'&&!document.body.classList.contains('home-opening'));
  assert(await page.locator('#start').isDisabled());assert.deepEqual(errors,[]);
  console.log(name+': menu loads, CLU disabled, keyboard skips it, touch credits launch/return works.');await page.close();
 }
}finally{await browser.close();}
