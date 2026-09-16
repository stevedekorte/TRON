import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5174');
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,yaw:0,turretYaw:0,aimPitch:0,recognizers:[],enemyTanks:[]}));
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#game'));
 // Deliver relative movement through the locked browser's input listener.
 await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:180,movementY:-80})));
 await page.waitForFunction(()=>__tron.state.mouseAim);
 assert.ok(await page.locator('#mouse-aim-target').isVisible());
 const goal=await page.evaluate(()=>({...__tron.state.mouseAim}));assert.ok(goal.yaw<0&&goal.pitch>0);
 await page.waitForFunction(()=>Math.abs(__tron.state.turretYaw-__tron.state.mouseAim.yaw)<.001&&Math.abs(__tron.state.aimPitch-__tron.state.mouseAim.pitch)<.001);
 await page.screenshot({path:'test-results/mouse-aim.png'});
 await page.mouse.click(720,450);await page.waitForFunction(()=>__tron.state.shots>0);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__tron.state.turretYaw===0&&__tron.state.aimPitch===0);assert.equal(await page.evaluate(()=>__tron.state.mouseAim),null);
 await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>__tron.state.mode==='paused');
 await page.keyboard.press('Enter');await page.mouse.click(720,450);await page.waitForFunction(()=>!!document.pointerLockElement);
 await page.keyboard.press('KeyV');await page.waitForFunction(()=>!document.pointerLockElement&&!__tron.state.gunner);assert.equal(await page.evaluate(()=>__tron.state.mode),'running');
 assert.deepEqual(errors,[]);console.log('Mouse capture, target convergence, marker, fire, F override, lock-loss pause, recapture and aerial exit pass.');
}finally{await browser.close();}
