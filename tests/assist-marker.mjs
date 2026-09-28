import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.locator('#start').click();await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(()=>{const e=__tron.state.recognizers[0];Object.assign(e,{x:-5000,s:-4840,y:40,vx:0,vs:0,vy:0,state:'wander',memory:null,nextSense:1e9,goal:null,goalUntil:1e9});__tron.place({x:-5000,s:-5000,yaw:0,turretYaw:0,speed:0,gunner:false,crushed:false,recognizers:[e],enemyTanks:[]});});
 await page.locator('#assist-marker').waitFor({state:'visible'});
 const flash=await page.locator('#assist-marker').evaluate(el=>{
   const a=el.getAnimations()[0];if(!a)throw Error('Missing acquisition flash');a.pause();
   const timing=a.effect.getTiming(),opacity=[];
   for(let n=0;n<3;n++)for(const phase of [.25,.75]){a.currentTime=(n+phase)*timing.duration;opacity.push(Number(getComputedStyle(el).opacity));}
   a.finish();return {duration:timing.duration,iterations:timing.iterations,opacity,width:getComputedStyle(el).width,height:getComputedStyle(el).height};
 });
 assert.equal(flash.duration,200);assert.equal(flash.iterations,3);assert.deepEqual(flash.opacity,[.5,0,.5,0,.5,0]);
 assert.equal(flash.width,'15px');assert.equal(flash.height,'6px');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#assist-marker').evaluate(el=>getComputedStyle(el).opacity),'0.5');
 assert.equal(await page.locator('#assist-marker').evaluate(el=>el.getAnimations().length),0);
 await page.screenshot({path:'test-results/assist-marker.png'});
 await page.evaluate(()=>__tron.place({turretYaw:Math.PI/2}));await page.locator('#assist-marker').waitFor({state:'hidden'});
 await page.evaluate(()=>__tron.place({turretYaw:0}));
 await page.locator('#assist-marker').waitFor({state:'visible'});
 assert.equal(await page.locator('#assist-marker').evaluate(el=>el.getAnimations().length),1,'new lock flashes again');
 await page.evaluate(()=>__tron.place({turretYaw:0,gunner:true}));await page.locator('#assist-marker').waitFor({state:'hidden'});
 await page.evaluate(()=>{const e=__tron.state.recognizers[0];e.state='destroyed';__tron.place({gunner:false,recognizers:[e]});});
 await page.waitForTimeout(100);assert.equal(await page.locator('#assist-marker').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Assisted target marker: acquisition, loss of alignment, manual gunner and destruction passed.');
}finally{await browser.close();}
