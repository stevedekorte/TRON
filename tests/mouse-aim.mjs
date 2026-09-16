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
 await page.keyboard.press('KeyP');await page.mouse.move(1000,300);
 await page.waitForFunction(()=>__tron.state.mouseAim);
 assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
 await page.waitForFunction(()=>Math.abs(__tron.state.turretYaw-__tron.state.mouseAim.yaw)<.001&&Math.abs(__tron.state.aimPitch-__tron.state.mouseAim.pitch)<.001);
 const center=await page.locator('#gunner-crosshair path').last().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 assert.ok(Math.abs(center.x-1000)<3&&Math.abs(center.y-300)<3,JSON.stringify(center));
 await page.screenshot({path:'test-results/mouse-aim.png'});
 await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>__tron.state.shots>0);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__tron.state.turretYaw===0&&__tron.state.aimPitch===0);
 await page.keyboard.down('KeyD');await page.waitForTimeout(600);await page.keyboard.up('KeyD');
 assert.equal(await page.evaluate(()=>__tron.state.turretYaw),0);assert.equal(await page.evaluate(()=>__tron.state.turretLocked),true);
 await page.mouse.move(900,250);await page.waitForFunction(()=>!__tron.state.turretLocked&&__tron.state.mouseAim);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__tron.state.aimPitch===0);
 await page.mouse.move(900,800);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__tron.state.aimPitch),0);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__tron.state.mode==='paused');
 await page.keyboard.press('Enter');await page.keyboard.press('KeyV');assert.equal(await page.evaluate(()=>__tron.state.gunner),false);
 assert.deepEqual(errors,[]);console.log('Absolute cursor targeting, crosshair alignment, no capture, fire, forward lock through hull turns, mouse unlock, base pitch limit and view lifecycle pass.');
}finally{await browser.close();}
