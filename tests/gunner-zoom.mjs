import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,recognizers:[],enemyTanks:[]}));
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>!__tron.state.camera.gunnerTransition&&__tron.state.gunner);
 const fov=()=>page.evaluate(()=>__tron.state.camera.fov);
 for(const target of [35,18,9,63]){
  const from=await fov();await page.keyboard.press('KeyO');await page.waitForTimeout(120);const middle=await fov();
  assert.ok(middle>Math.min(from,target)&&middle<Math.max(from,target),`${from} -> ${middle} -> ${target}`);
  await page.waitForFunction(target=>__tron.state.camera.fov===target,target);
 }
 await page.mouse.move(640,400);
 for(const [delta,target] of [[-100,35],[-100,18],[-100,9],[-100,9],[100,18],[100,35],[100,63],[100,63]]){
  await page.mouse.wheel(0,delta);await page.waitForFunction(target=>__tron.state.camera.fov===target,target);await page.waitForTimeout(200);
 }
 const label=await page.locator('#gunner-zoom').boundingBox(),sight=await page.locator('#gunner-sight').boundingBox();
 assert.ok(Math.abs(label.x+label.width/2-(sight.x+sight.width/2))<3);assert.ok(label.y<sight.height*.25);assert.ok(label.height>25);
 await page.screenshot({path:'test-results/gunner-zoom.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyP');await page.keyboard.press('KeyO');await page.waitForTimeout(60);assert.equal(await fov(),35);
 assert.deepEqual(errors,[]);console.log('Zoom eases across all four levels including wrap; larger label centered above sight; reduced motion snaps.');
}finally{await browser.close();}
