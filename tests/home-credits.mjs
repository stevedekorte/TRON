import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce',hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-credits').disabled);
 await page.screenshot({path:'test-results/home-credits-menu.png'});
 await page.keyboard.press('ArrowUp');
 assert.equal(await page.locator('#start-credits').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('victory-credits'));
 assert.equal(await page.locator('#terminal-text').textContent(),'');
 assert.equal(await page.locator('#game-menu').isVisible(),false);
 assert.match(await page.locator('#end-tribute').getAttribute('aria-label'),/EXTENDED CREDITS/);
 await page.waitForFunction(()=>document.querySelector('#tribute-text').textContent.length>0);
 await page.screenshot({path:'test-results/home-credits.png'});
 for(const key of ['KeyA','ArrowDown','KeyC']){await page.keyboard.press(key);assert.equal(await page.locator('#game-menu').isVisible(),false);}
 await page.keyboard.press('Space');
 assert.match(await page.locator('#tribute-text').textContent(),/A USER AND A PROGRAM/);
 await page.keyboard.press('Space');
 assert.match(await page.locator('#tribute-text').textContent(),/EXTENDED CREDITS/);
 await page.waitForFunction(()=>document.querySelector('#tribute-text').textContent.includes('EXTENDED CREDITS'),null,{timeout:120000});
 await page.keyboard.press('Escape');
 await page.locator('#start-credits').waitFor({state:'visible'});
 await page.locator('#start-credits').click();
 await page.waitForFunction(()=>document.body.classList.contains('victory-credits'));
 await page.locator('#end-tribute').click();
 await page.locator('#start-credits').waitFor({state:'visible'});
 for(const key of ['Enter','NumpadEnter']){
  await page.locator('#start-credits').click();await page.keyboard.press(key);
  await page.locator('#start-credits').waitFor({state:'visible'});
 }
 await page.locator('#start-credits').click();await page.touchscreen.tap(30,30);
 await page.locator('#start-credits').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);
 console.log('Home credits: keyboard/click entry, no detached header, standard and extended credits, and return to menu passed.');
}finally{await browser.close();}
