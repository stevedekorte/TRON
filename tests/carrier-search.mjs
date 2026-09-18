import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyP');await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');
 await page.evaluate(async()=>{
  const {CARRIER}=await import('/src/game/carrier.js');const r=__tron.state;
  __tron.place({x:CARRIER.startX+CARRIER.speed*r.time,s:CARRIER.s,yaw:0,turretYaw:0,speed:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});
 });
 await page.waitForFunction(()=>__tron.state.carrierSearch.illuminated&&__tron.state.carrierBeamVisuals.every(b=>b.visible&&b.strength>.5));
 await page.keyboard.press('KeyV');await page.waitForTimeout(1500);await page.screenshot({path:'test-results/carrier-search.png'});
 await page.evaluate(()=>__tron.place({crushed:true}));await page.waitForFunction(()=>__tron.state.carrierBeamVisuals.every(b=>!b.visible));
 assert.deepEqual(errors,[]);console.log('Two carrier tracking lights render, acquire CLU and fade out on destruction without browser errors.');
}finally{await browser.close();}
