import {chromium} from '@playwright/test';
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {MP} from '../../shared/multiplayer/config.js';
import {decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
const base=process.env.TRON_URL||'http://127.0.0.1:5177/';
const url=new URL('/api/multiplayer?v='+MP.protocol,base);url.protocol='ws:';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const socket=new WebSocket(url,{origin:new URL(base).origin});let id,state;
try{
 await new Promise((resolve,reject)=>{socket.on('error',reject);socket.on('message',raw=>{const d=JSON.parse(raw);if(d.type==='welcome')id=d.id;if(d.type==='state'){state=decodeSnapshot(d,state);resolve();}});});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled);
 await page.locator('#start-multiplayer').click();
 await page.waitForFunction(()=>window.__tron?.state.multiplayer&&__tron.state.mode==='running',{}, {timeout:60000});
 if(process.env.TRON_CYCLE_RENDERER)await page.evaluate(mode=>__tron.setCycleRenderer(mode),process.env.TRON_CYCLE_RENDERER);
 // The silent socket client never holds the round. Start a fresh one so the page sees a whole formation.
 for(let i=0;i<300&&!await page.evaluate(()=>__tron.state.multiplayer?.canRestart);i++)await page.waitForTimeout(500);
 const round=await page.evaluate(()=>__tron.state.cycleRace.round);
 await page.keyboard.press('Enter');await page.waitForFunction(r=>__tron.state.cycleRace.round>r,round);
 assert(await page.evaluate(()=>__tron.state.cycleRace.materializing&&!__tron.state.cycleRace.cameraStaging),'a new round materializes at once');
 assert(!/MATCH STARTS IN/.test(await page.locator('#cycle-controls').textContent()));
 await page.waitForTimeout(800);await page.screenshot({path:'test-results/mp-team-materialization.png'});
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing',null,{timeout:4000});
 const before=await page.evaluate(()=>__tron.state.camera);
 await page.waitForTimeout(300);
 const launch=await page.evaluate(()=>({camera:__tron.state.camera,race:__tron.state.cycleRace}));
 assert(Math.hypot(launch.camera.x-before.x,launch.camera.y-before.y,launch.camera.z-before.z)<.01,'launch holds formation camera while bikes move');
 assert(launch.race.elapsed>0,'cycles are racing during the camera hold');
 assert(launch.race.trails.some(t=>Math.hypot(t.x2-t.x1,t.z2-t.z1)>.5),'launch draws growing cycle walls');
 await page.screenshot({path:'test-results/mp-team-launch-hold.png'});
 await page.waitForTimeout(450);await page.screenshot({path:'test-results/mp-team-launch.png'});
 const after=await page.evaluate(()=>__tron.state.camera);
 assert(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)>2,'launch cuts to player follow');
 assert.deepEqual(errors,[]);console.log('Immediate materialization with a silent client, launch hold and player launch passed.');
}finally{socket.close();await browser.close();}
