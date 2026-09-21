import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 const pads=await page.evaluate(()=>__tron.state.teleportPads);assert.equal(pads.length,16);
 const source=pads[0],dest=pads.find(p=>p.id===source.destination);
 await page.evaluate(p=>__tron.place({x:p.x,s:p.s-35,yaw:0,turretYaw:0,speed:0,cruiseThrottle:false,recognizers:[],enemyTanks:[]}),source);
 await page.waitForTimeout(300);await page.screenshot({path:'test-results/teleporter-pad.png'});
 // Drive completely inside; this uses the real fixed-step trigger.
 await page.keyboard.down('w');await page.waitForFunction(()=>__tron.state.teleport?.phase==='out');await page.keyboard.up('w');
 await page.waitForTimeout(700);await page.keyboard.press('Escape');
 const paused=await page.evaluate(()=>__tron.state.time);await page.screenshot({path:'test-results/teleporter-dematerialize.png'});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__tron.state.time),paused);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__tron.state.teleport?.phase==='in');
 assert.equal(await page.evaluate(()=>__tron.state.x),dest.x);await page.waitForTimeout(1000);await page.screenshot({path:'test-results/teleporter-materialize.png'});
 await page.waitForFunction(()=>!__tron.state.teleport);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__tron.state.teleportArrival),dest.id);await page.screenshot({path:'test-results/teleporter-arrived.png'});
 assert.deepEqual(errors,[]);
 // An existing aircraft and a ground tank use the same animation/pool path.
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(p=>{const r=__tron.state,e=r.recognizers[0],tank=r.enemyTanks[0];Object.assign(e,{x:p[0].x,s:p[0].s,y:60,yaw:0,speed:0,vx:0,vs:0,vy:0,state:'wander',stompDisabled:true});Object.assign(tank,{x:p[1].x,s:p[1].s,yaw:0,speed:0,turretYaw:0});__tron.place({x:p[0].x,s:p[0].s-55,yaw:0,speed:0,cruiseThrottle:false,recognizers:[e],enemyTanks:[tank]});},pads);
 await page.waitForFunction(()=>__tron.state.recognizers[0].teleport&&__tron.state.enemyTanks[0].teleport);
 await page.waitForTimeout(900);await page.screenshot({path:'test-results/teleporter-recognizer.png'});
 await page.waitForFunction(()=>!__tron.state.recognizers[0].teleport&&!__tron.state.enemyTanks[0].teleport);
 assert.equal(await page.evaluate(()=>__tron.state.recognizers[0].teleportArrival),dest.id);
 await page.evaluate(()=>__tron.reset());assert.equal(await page.evaluate(()=>__tron.state.teleport),null);assert.deepEqual(errors,[]);
 console.log('16 pads; driven whole-footprint entry; both effects; pause; destination lock; aircraft/ground-tank transfer; reset; no browser errors.');
}finally{await browser.close();}
