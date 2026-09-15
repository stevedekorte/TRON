import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>__tron.state.enemyTanks.length),11);
 await page.evaluate(()=>{const r=__tron.state,e=r.enemyTanks[3];__tron.place({x:e.x,s:e.s-160,yaw:0,turretYaw:0,speed:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'}))});});
 await page.keyboard.press('Enter');await page.waitForTimeout(1600);await page.keyboard.press('Escape');
 await page.screenshot({path:'test-results/ground-escort.png'});
 const before=await page.evaluate(()=>__tron.state.enemyTanks);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>__tron.state.enemyTanks),before);
 await page.evaluate(()=>{const r=__tron.state;__tron.place({x:-5000,s:-5000,yaw:0,turretYaw:0,speed:0,health:3,crushed:false,projectiles:[],enemyTanks:r.enemyTanks.map((e,i)=>({...e,x:-5000+i*30,s:-4930,yaw:Math.PI,turretYaw:Math.PI/2,speed:0,vx:0,vs:0,state:i?'destroyed':'escort',targetGone:false,nextSense:0,memory:null,nextRoute:0,path:[]}))});});
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.projectiles.some(p=>p.faction==='enemy'),{timeout:10000});
 await page.keyboard.press('Escape');
 const aimed=await page.evaluate(()=>({e:__tron.state.enemyTanks[0],v:__tron.state.enemyTankVisuals[0]}));assert.ok(Math.abs(aimed.e.turretYaw)<.15);assert.ok(Math.abs(aimed.v.barrelPitch)<1e-8);assert.ok(Math.abs(aimed.v.turretYaw-aimed.e.turretYaw)<.01);
 await page.screenshot({path:'test-results/enemy-tank-firing.png'});
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.crushed,{timeout:15000});
 assert.ok(await page.evaluate(()=>__tron.state.breakups.some(b=>b.subject==='tank')));
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{const r=__tron.state;__tron.place({x:-5000,s:-5000,yaw:0,turretYaw:0,speed:0,crushed:false,health:3,projectiles:[],enemyTanks:r.enemyTanks.map((e,i)=>({...e,x:-5000,s:-4960,state:i?'destroyed':'escort',health:1,speed:0,vx:0,vs:0,nextSense:Infinity,memory:null,targetGone:false,nextRoute:Infinity,path:[]}))});});
 await page.keyboard.press('Enter');await page.keyboard.press('Space');await page.waitForFunction(()=>__tron.state.enemyTanks[0].state==='destroyed');await page.keyboard.press('Escape');
 assert.ok(await page.evaluate(()=>__tron.state.breakups.some(b=>b.subject==='enemyTank')));assert.equal(await page.evaluate(()=>__tron.state.enemyTankVisuals[0].visible),false);
 await page.screenshot({path:'test-results/enemy-tank-breakup.png'});
 await page.keyboard.press('Enter');await page.keyboard.press('r');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__tron.state.enemyTanks.filter(e=>e.state!=='destroyed').length),11);
 assert.deepEqual(errors,[]);console.log('Eleven tanks render; turret/fire, Clu breakup, pause and reset pass without browser errors.');
}finally{await browser.close();}
