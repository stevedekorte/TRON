// Regression coverage for replacing animated typing with immediate text.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true,args:['--autoplay-policy=document-user-activation-required']});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173');
 assert.equal(await page.locator('#begin').count(),0);
 assert.equal(await page.locator('#terminal-text').textContent(),'REQUEST ACCESS TO CLU PROGRAM\nCODE 6 PASSWORD TO MEMORY 0222');
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 assert.equal(await page.evaluate(()=>window.__tron.state.terminalClicks),0);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='entering');
 await page.waitForFunction(()=>window.__tron.state.audioState==='running');
 console.log('Static terminal text, no initial button or typing sounds; one Return starts opening and unlocks audio.');
}finally{await browser.close();}
