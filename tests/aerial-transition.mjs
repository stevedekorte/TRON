import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyW');
 await page.evaluate(()=>{const r=__tron.state;__tron.place({x:-5000,s:-5000,speed:0,yaw:0,turretYaw:Math.PI/2,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});});
 await page.waitForTimeout(200);await page.keyboard.press('KeyV');await page.waitForTimeout(350);
 const midway=await page.evaluate(()=>__tron.state.camera.y);assert(midway>10&&midway<500);
 await page.waitForTimeout(1800);
 let state=await page.evaluate(()=>__tron.state);assert(Math.abs(state.camera.y-600)<2);assert(state.camera.x>state.x+360);assert(Math.abs(state.camera.z+state.s)<3);
 await page.keyboard.down('KeyJ');await page.waitForTimeout(500);await page.keyboard.up('KeyJ');await page.waitForTimeout(1400);
 state=await page.evaluate(()=>__tron.state);const bearing=Math.atan2(state.camera.x-state.x,state.camera.z+state.s);
 assert(Math.abs(bearing-state.yaw-state.turretYaw)<.02);
 await page.mouse.move(600,400);await page.mouse.wheel(0,240);
 await page.waitForFunction(()=>__tron.state.aerialZoom>1.3);
 await page.waitForTimeout(600);assert((await page.evaluate(()=>__tron.state.camera.y))>750);
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>__tron.state.time);
 await page.mouse.wheel(0,-240);await page.waitForFunction(()=>Math.abs(__tron.state.aerialZoom-1)<.01);
 await page.waitForFunction(()=>Math.abs(__tron.state.camera.y-600)<2);assert.equal(await page.evaluate(()=>__tron.state.time),paused);
 assert(Math.abs((await page.evaluate(()=>__tron.state.camera.y))-600)<2);
 await page.keyboard.press('Enter');
 await page.keyboard.press('KeyV');await page.waitForTimeout(350);const down=await page.evaluate(()=>__tron.state.camera.y);assert(down>30&&down<590);
 await page.waitForTimeout(2000);assert(await page.evaluate(()=>__tron.state.camera.y)<10);
 assert.deepEqual(errors,[]);console.log('V animates both directions; aerial heading follows the turret; wheel zoom works running and paused.');
}finally{await browser.close();}
