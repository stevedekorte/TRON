import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'no-preference'}),errors=[];
 page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForTimeout(100);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('w');
 await page.evaluate(()=>{const b=__tron.state.dataBeams[0];__tron.place({x:b.x,s:b.s,yaw:0,turretYaw:0,speed:0,recognizers:[],enemyTanks:[]});});
 await page.waitForFunction(()=>__tron.state.camera.beamCinematic?.phase==='orbit');
 assert((await page.evaluate(()=>__tron.state.camera.y))>590);
 assert.equal(await page.evaluate(()=>__tron.state.turretYaw),0);
 await page.screenshot({path:'test-results/beam-camera-orbit.png'});
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>__tron.state.camera);await page.waitForTimeout(300);
 assert.deepEqual(await page.evaluate(()=>__tron.state.camera),paused);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>__tron.state.camera.beamCinematic?.phase==='return');
 await page.waitForFunction(()=>__tron.state.time-__tron.state.dataBeams[0].transferStartedAt>=12.6);
 assert((await page.evaluate(()=>__tron.state.camera.y))<15);
 await page.screenshot({path:'test-results/beam-camera-return.png'});
 assert.deepEqual(errors,[]);console.log('Beam camera: half-speed rise, orbit, pause, return by ring opening; turret unchanged; no browser errors.');
}finally{await browser.close();}
