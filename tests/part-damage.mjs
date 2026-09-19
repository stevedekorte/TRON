import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 const prepare=()=>page.evaluate(()=>{
  const r=__tron.state;__tron.place({x:-5000,s:-5000,speed:0,yaw:0,recognizers:r.recognizers.map((e,i)=>({...e,x:-5000,s:-4910,y:60,yaw:0,health:3,state:i?'destroyed':'wander',vx:0,vs:0,vy:0,nextSense:Infinity,memory:null,goal:null,attack:null,fold:0,partHits:{},stompDisabled:false})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});
 });
 const shoot=(x,y)=>page.evaluate(({x,y})=>{const e=__tron.state.recognizers[0];__tron.place({projectiles:[{x:e.x+x*.65,y:e.y+y*.65,s:e.s,vx:0,vs:0,vy:0,life:1}]});},{x,y});
 await prepare();await shoot(0,6);await page.waitForFunction(()=>__tron.state.recognizers[0].state==='destroyed');assert.equal(await page.evaluate(()=>__tron.state.recognizers[0].health),0);
 await prepare();await shoot(-14,-12);await page.waitForFunction(()=>__tron.state.recognizers[0].health===2.5);
 await shoot(-14,-12);await page.waitForFunction(()=>__tron.state.recognizers[0].stompDisabled);assert.equal(await page.evaluate(()=>__tron.state.recognizers[0].health),2);
 await page.waitForTimeout(500);await page.screenshot({path:'test-results/disabled-recognizer-leg.png'});
 assert.deepEqual(errors,[]);console.log('Crown hit kills in one shot; two leg hits leave the Recognizer alive with stomp disabled; damaged rendering has no page errors.');
}finally{await browser.close();}
