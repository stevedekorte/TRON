import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.up('KeyW');
 await page.evaluate(()=>{const r=__tron.state;__tron.place({x:-5000,s:-5000,speed:0,yaw:0,turretYaw:0,aimPitch:.34,enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'})),recognizers:r.recognizers.map((e,i)=>({...e,x:-5000,s:-4800,y:77,state:i?'destroyed':'wander',nextSense:Infinity,nextAttack:Infinity,goal:{x:-5000,s:-4700},goalUntil:Infinity,vx:0,vs:0}))});});
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.gunner&&!__tron.state.tankVisible);assert.ok(await page.locator('#gunner-sight').isVisible());
 const initialYaw=await page.evaluate(()=>__tron.state.turretYaw);
 for(const key of ['KeyQ','KeyE']){await page.keyboard.down(key);await page.waitForTimeout(100);await page.keyboard.up(key);assert.equal(await page.evaluate(()=>__tron.state.turretYaw),initialYaw);}
 await page.keyboard.down('KeyJ');await page.waitForTimeout(100);await page.keyboard.up('KeyJ');assert.ok(await page.evaluate(()=>__tron.state.turretYaw)>initialYaw);
 await page.keyboard.down('KeyL');await page.waitForTimeout(100);await page.keyboard.up('KeyL');
 await page.waitForTimeout(600);
 const heading=await page.evaluate(()=>__tron.state.yaw+__tron.state.turretYaw);
 await page.keyboard.down('KeyD');await page.waitForTimeout(500);await page.keyboard.up('KeyD');
 assert.ok(Math.abs(await page.evaluate(()=>__tron.state.yaw+__tron.state.turretYaw)-heading)<.001);
 const pitch=await page.evaluate(()=>__tron.state.aimPitch);await page.keyboard.down('KeyI');await page.waitForTimeout(200);await page.keyboard.up('KeyI');assert.ok(await page.evaluate(()=>__tron.state.aimPitch)>pitch);
 await page.keyboard.down('KeyK');await page.waitForTimeout(200);await page.keyboard.up('KeyK');
 await page.keyboard.press('KeyO');await page.waitForFunction(()=>__tron.state.gunnerZoom===1&&document.querySelector('#gunner-zoom').textContent==='2×');assert.equal(await page.locator('#gunner-zoom').textContent(),'2×');
 await page.screenshot({path:'test-results/gunner-sight.png'});
 await page.keyboard.press('KeyO');await page.keyboard.press('KeyO');
 await page.waitForFunction(()=>__tron.state.gunnerZoom===3&&document.querySelector('#gunner-zoom').textContent==='8×');
 await page.screenshot({path:'test-results/gunner-sight-8x.png'});
 await page.keyboard.press('KeyO');assert.equal(await page.evaluate(()=>__tron.state.gunnerZoom),0);
 await page.waitForTimeout(600);await page.keyboard.press('Space');await page.waitForFunction(()=>__tron.state.projectiles.length>0);
 const projection=await page.evaluate(async()=>{const {cannonPose}=await import('/src/simulation/run.js');const r=__tron.state,p=cannonPose(r),pitch=r.aimPitch;return __tron.project({x:p.x-Math.sin(p.yaw)*Math.cos(pitch)*100,y:p.y+Math.sin(pitch)*100,s:p.s+Math.cos(p.yaw)*Math.cos(pitch)*100});});assert.ok(Math.abs(projection.x)<.01&&Math.abs(projection.y)<.01);
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>__tron.state.aimPitch===0&&!__tron.state.gunnerLeveling);
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>__tron.state.aimPitch);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__tron.state.aimPitch),frozen);
 await page.keyboard.press('Enter');await page.keyboard.press('KeyP');await page.waitForFunction(()=>!__tron.state.gunner&&__tron.state.tankVisible);assert.equal(await page.locator('#gunner-sight').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Gunner sight, independent aim, hull stabilization, zoom cycle, centered shot direction, pause and exit pass.');
}finally{await browser.close();}
