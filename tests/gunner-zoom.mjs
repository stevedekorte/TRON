import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 assert.equal(await page.evaluate(()=>__tron.state.recognizers.filter(e=>e.role==='pursuer').length),5);
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,recognizers:[],enemyTanks:[]}));
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>!__tron.state.camera.gunnerTransition&&__tron.state.gunner);
 const fov=()=>page.evaluate(()=>__tron.state.camera.fov);
 for(const target of [18,9,35]){
  const from=await fov();await page.keyboard.press('KeyO');await page.waitForTimeout(120);const middle=await fov();
  assert.ok(middle>Math.min(from,target)&&middle<Math.max(from,target),`${from} -> ${middle} -> ${target}`);
  await page.waitForFunction(target=>__tron.state.camera.fov===target,target);
 }
 await page.mouse.move(640,400);
 const before=await page.evaluate(()=>({yaw:__tron.state.turretYaw,shots:__tron.state.shots}));
 await page.mouse.click(640,400);await page.mouse.move(850,450);await page.mouse.wheel(0,-100);await page.waitForTimeout(250);
 assert.equal(await fov(),35);assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
 assert.deepEqual(await page.evaluate(()=>({yaw:__tron.state.turretYaw,shots:__tron.state.shots})),before);
 const label=await page.locator('#gunner-zoom').boundingBox(),sight=await page.locator('#gunner-sight').boundingBox();
 assert.ok(Math.abs(label.x+label.width/2-(sight.x+sight.width/2))<3);assert.ok(label.y<sight.height*.25);assert.ok(label.height>25);
 await page.screenshot({path:'test-results/gunner-zoom.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyP');await page.keyboard.press('KeyO');await page.waitForTimeout(60);assert.equal(await fov(),18);
 assert.deepEqual(errors,[]);console.log('Zoom eases across 2×, 4× and 8× including wrap; larger label centered above sight; reduced motion snaps.');
}finally{await browser.close();}
