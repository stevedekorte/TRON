import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('w');await page.evaluate(()=>__tron.place({speed:0,recognizers:[],enemyTanks:[]}));await page.waitForTimeout(300);
 await page.screenshot({path:'test-results/pad-horizon.png'});
 assert((await page.evaluate(()=>__tron.state.carrierBeamVisuals)).every(b=>!b.visible));
 const pads=await page.evaluate(()=>__tron.state.teleportPads),source=pads[0],dest=pads.find(p=>p.id===source.destination);
 await page.evaluate(p=>__tron.place({x:p.x,s:p.s-24,yaw:0,turretYaw:0,speed:0,cruiseThrottle:false,recognizers:[],enemyTanks:[]}),source);
 // Release the initial automatic opening throttle, then hold still across the boundary.
 await page.keyboard.press('w');await page.evaluate(()=>__tron.place({speed:0}));await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>__tron.state.teleportRevision),0);
 await page.screenshot({path:'test-results/teleporter-partial.png'});
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>__tron.state.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__tron.state.time),paused);
 await page.keyboard.press('Escape');await page.keyboard.down('w');await page.waitForFunction(()=>__tron.state.teleportRevision===1);
 assert.equal(await page.evaluate(()=>__tron.state.teleportArrival),dest.id);assert(await page.evaluate(()=>__tron.state.speed>0));
 await page.screenshot({path:'test-results/teleporter-wire-arrival.png'});
 await page.waitForFunction(()=>__tron.state.teleportArrival===null);await page.keyboard.up('w');
 assert.equal(await page.evaluate(()=>__tron.state.teleportRevision),1);await page.screenshot({path:'test-results/teleporter-solid-exit.png'});
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(()=>__tron.state.mode==='running');
 // Freeze aircraft navigation to inspect the partial top-plane effect and depth atlas.
 await page.evaluate(p=>{const r=__tron.state,e=r.recognizers[0];Object.assign(e,{x:p.x,s:p.s,y:p.height+2,yaw:0,vx:0,vs:0,vy:0,state:'wander',stompDisabled:true});__tron.place({x:p.x,s:p.s-60,yaw:0,speed:0,cruiseThrottle:false,recognizers:[e],enemyTanks:[]});},source);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(50);await page.keyboard.press('Escape');await page.screenshot({path:'test-results/teleporter-aircraft.png'});
 assert.deepEqual(errors,[]);console.log('Partial entry, stationary clipping, instantaneous moving transfer, exit lock, pause and aircraft shaders: passed.');
}finally{await browser.close();}
