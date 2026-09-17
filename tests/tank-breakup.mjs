import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>window.__tron.state.mode==='ready');
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='running');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{
  const r=window.__tron.state,recognizers=r.recognizers.map((e,i)=>({...e,x:-1800,s:-1800,y:65,state:i?'destroyed':'wander',attack:null,fold:0,nextAttack:0,nextSense:0,memory:null,goal:null,vx:0,vs:0}));
  window.__tron.place({x:-1800,s:-1800,speed:0,yaw:0,turretYaw:.8,crushed:false,recognizers});
 });
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__tron.state.crushed,{},{timeout:12000});
 await page.waitForTimeout(200);await page.keyboard.press('Escape');
 const state=await page.evaluate(()=>window.__tron.state);
 assert.equal(state.tankVisible,false);assert.equal(state.breakups.length,1);assert.equal(state.breakups[0].subject,'tank');
 assert.ok(state.breakups[0].pieces.length>=8);assert.ok(state.breakups[0].pieces.every(p=>p.fragmented&&p.part==='tank'));
 await page.screenshot({path:'test-results/clu-breakup.png'});
 await page.waitForTimeout(150);assert.deepEqual((await page.evaluate(()=>window.__tron.state)).breakups,state.breakups);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.breakups.length===0,{},{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__tron.state.tankVisible),false);
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(()=>window.__tron.state.tankVisible);
 assert.equal(await page.evaluate(()=>window.__tron.state.crushed),false);assert.deepEqual(errors,[]);
 console.log('Stomp creates posed CLU fragments, hides tank/shadow, freezes debris on pause, expires debris and restores CLU on restart.');
}finally{await browser.close();}
