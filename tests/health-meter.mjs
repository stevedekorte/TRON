import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 assert.equal(await page.locator('#clu-health').isVisible(),false);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,speed:0,health:1,recognizers:[],enemyTanks:[]}));
 await page.waitForFunction(()=>document.querySelector('#health-meter').getAttribute('aria-valuenow')==='34');
 assert.ok(await page.locator('#clu-health').isVisible());
 const before=await page.evaluate(()=>({time:__tron.state.time,health:__tron.state.health}));
 await page.waitForTimeout(1200);const after=await page.evaluate(()=>({time:__tron.state.time,health:__tron.state.health}));
 assert.ok(after.health>before.health);assert.ok(Math.abs(after.health-before.health-(after.time-before.time)*.01)<1e-8);
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>__tron.state.health);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__tron.state.health),frozen);
 await page.keyboard.press('Enter');await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.gunner&&!__tron.state.camera.gunnerTransition&&__tron.state.camera.gunnerOpacity===1);assert.ok(await page.locator('#clu-health').isVisible());
 assert.equal(await page.locator('#turbo > span').textContent(),'T / TURBO');
 await page.evaluate(()=>__tron.place({turboCooldown:30}));await page.waitForFunction(()=>document.querySelector('#turbo').getAttribute('aria-label')==='Turbo recharging');
 for(const [health,level] of [[2.7,'normal'],[1.2,'orange'],[.6,'red'],[.24,'critical']]){
  await page.evaluate(health=>__tron.place({health}),health);await page.waitForFunction(level=>document.querySelector('#clu-health').dataset.level===level,level);
 }
 assert.equal(await page.locator('#health-fill').evaluate(el=>getComputedStyle(el).animationName),'health-warning');
 assert.equal((await page.locator('#clu-health').textContent()).trim(),'HEALTH');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#health-fill').evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.screenshot({path:'test-results/health-meter.png'});
 await page.evaluate(()=>{const r=__tron.state;__tron.place({health:.5,projectiles:[{x:r.x,y:2.3,s:r.s-3.6,vx:0,vs:165,vy:0,life:2,faction:'enemy',owner:100}]});});
 await page.waitForFunction(()=>__tron.state.crushed);assert.equal(await page.evaluate(()=>__tron.state.health),0);
 assert.deepEqual(errors,[]);console.log('Health HUD reflects fractional regeneration, freezes on pause, stays visible in gunner view, and death remains final.');
}finally{await browser.close();}
