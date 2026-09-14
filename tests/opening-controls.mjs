import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='entering');
 await page.keyboard.down('KeyS');await page.keyboard.down('KeyD');await page.keyboard.down('KeyL');await page.waitForTimeout(350);
 let state=await page.evaluate(()=>window.__tron.state);
 assert.ok(state.speed<20);assert.ok(Math.abs(state.yaw)>.02);assert.ok(Math.abs(state.turretYaw)>.1);
 await page.keyboard.up('KeyS');await page.keyboard.up('KeyD');await page.keyboard.up('KeyL');
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.__tron.state.turretYaw===0);
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__tron.state.shots>0);
 assert.equal(await page.evaluate(()=>window.__tron.state.mode),'entering');
 await page.mouse.move(600,450);await page.mouse.down();await page.waitForFunction(()=>window.__tron.state.shots>1);await page.mouse.up();
 assert.ok(await page.evaluate(()=>window.__tron.state.shots)>1);
 await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__tron.state.mode==='running');
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__tron.state.speed),22);
 await page.keyboard.up('KeyW');assert.deepEqual(errors,[]);
 console.log('Driving, J/L, F and keyboard/mouse firing work during zoom; held controls survive arrival.');
}finally{await browser.close();}
