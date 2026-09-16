import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,yaw:0,turretYaw:.5,aimPitch:.5,gunnerZoom:3,recognizers:[],enemyTanks:[]}));await page.waitForTimeout(300);
 const before=await page.evaluate(()=>__tron.state.camera);
 await page.keyboard.press('KeyP');await page.waitForTimeout(250);
 const middle=await page.evaluate(()=>__tron.state.camera);assert.equal(middle.gunnerTransition,true);assert.ok(middle.gunnerOpacity>0&&middle.gunnerOpacity<1);assert.ok(middle.fov>9&&middle.fov<before.fov);
 await page.waitForFunction(()=>!__tron.state.camera.gunnerTransition);const inside=await page.evaluate(()=>__tron.state);assert.equal(inside.camera.fov,9);assert.equal(inside.tankVisible,false);
 const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0))));assert.ok(angle(before.rotation,middle.rotation)>.01);assert.ok(angle(middle.rotation,inside.camera.rotation)>.01);
 await page.keyboard.press('KeyP');await page.waitForTimeout(250);const leaving=await page.evaluate(()=>__tron.state.camera);assert.ok(leaving.gunnerTransition&&leaving.fov>9&&leaving.fov<before.fov);
 await page.waitForFunction(()=>!__tron.state.camera.gunnerTransition);assert.equal(await page.locator('#gunner-sight').isVisible(),false);
 await page.keyboard.press('KeyP');await page.waitForTimeout(200);const a=await page.evaluate(()=>__tron.state.camera);await page.keyboard.press('KeyP');const b=await page.evaluate(()=>__tron.state.camera);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<3);
 await page.waitForFunction(()=>!__tron.state.camera.gunnerTransition);
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyP');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__tron.state.camera.gunnerTransition),false);
 assert.deepEqual(errors,[]);console.log('Gunner entry/exit ease position, rotation and FOV; sight fades; mid-transition reversal is continuous; reduced motion skips animation.');
}finally{await browser.close();}
