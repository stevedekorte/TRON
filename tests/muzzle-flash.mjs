import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');await page.keyboard.press('Escape');
 await page.evaluate(()=>__tron.place({x:-1800,s:-1800,speed:0,yaw:0,turretYaw:1,recoil:.8,shots:1,gunner:false}));
 await page.waitForFunction(()=>__tron.state.weaponVisual.muzzleFlashVisible);
 await page.screenshot({path:'test-results/clu-muzzle-flash.png'});
 const age=await page.evaluate(()=>__tron.state.weaponVisual.muzzleFlashAge);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__tron.state.weaponVisual.muzzleFlashAge),age);
 await page.evaluate(()=>__tron.place({gunner:true,aimPitch:.2,recoil:.8}));await page.waitForFunction(()=>__tron.state.gunner&&!__tron.state.tankVisible);
 await page.screenshot({path:'test-results/clu-muzzle-flash-gunner.png'});
 assert.ok(await page.evaluate(()=>__tron.state.weaponVisual.muzzleFlashVisible));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>!__tron.state.weaponVisual.muzzleFlashVisible);
 await page.keyboard.press('Space');await page.waitForFunction(()=>__tron.state.weaponVisual.muzzleFlashVisible);
 await page.waitForFunction(()=>!__tron.state.weaponVisual.muzzleFlashVisible);
 assert.deepEqual(errors,[]);console.log('Cyan muzzle flash renders in chase/gunner views, freezes on pause and expires after firing.');
}finally{await browser.close();}
