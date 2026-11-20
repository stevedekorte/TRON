// With several humans, Return starts a new multiplayer match only once no
// human's cycle is alive; then any connected human may. A second human joins
// over a raw socket; neither steers, so both cycles eventually hit the wall.
import {MP} from '../../shared/multiplayer/config.js';
import {decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const socketUrl=new URL('/api/multiplayer?v='+MP.protocol,base);socketUrl.protocol=socketUrl.protocol==='https:'?'wss:':'ws:';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
let socket;
try{
 const context=await browser.newContext({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[];
 await context.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 await page.locator('#start-multiplayer').click();
 await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle'&&__tron.state.mode==='running'&&!document.body.classList.contains('home-transition'),null,{timeout:60000});
 // Second human: a wire client that confirms its camera each round and never steers.
 await new Promise((resolve,reject)=>{
  socket=new WebSocket(socketUrl,{origin:new URL(base).origin});socket.once('error',reject);
  socket.on('message',raw=>{const d=JSON.parse(raw);if(d.type==='welcome')socket.playerId=d.id;
   if(d.type==='state'){socket.latest=decodeSnapshot(d,socket.latest);if(!socket.latest)return;const me=socket.latest.clients.find(c=>c.id===socket.playerId);
    if(me&&socket.latest.race.cameraStaging&&me.seat!==null)socket.send(JSON.stringify({type:'camera-ready',round:socket.latest.race.round,seat:me.seat}));resolve();}});
 });
 const humansAlive=()=>{const s=socket.latest;return s.clients.filter(c=>c.seat!==null&&s.race.cycles[c.seat]?.alive).length;};
 // Wait for a round where both humans hold seats and race.
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing',null,{timeout:90000});
 for(let i=0;i<300&&!(socket.latest.clients.length===2&&socket.latest.clients.every(c=>c.seat!==null)&&socket.latest.race.phase==='racing');i++)await page.waitForTimeout(100);
 assert.equal(socket.latest.clients.length,2);
 const teams=socket.latest.clients.map(c=>socket.latest.race.cycles[c.seat].team);
 assert.equal(teams[0],teams[1],'both humans are placed on the same team');
 const round=await page.evaluate(()=>__tron.state.cycleRace.round);
 assert(humansAlive()>0);
 assert(!(await page.locator('#cycle-controls').textContent()).includes('NEW MATCH'),'no restart prompt while a human is alive');
 await page.keyboard.press('Enter');await page.waitForTimeout(800);
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.round),round,'Return cannot reset a match with a living human');
 // Both unsteered cycles crash into the arena wall (or a trail).
 for(let i=0;i<1200&&(humansAlive()>0)&&socket.latest.race.round===round;i++)await page.waitForTimeout(100);
 assert.equal(socket.latest.race.round,round,'the round is still on when the last human falls');
 assert.equal(humansAlive(),0,'both human cycles are down');
 await page.waitForFunction(()=>document.querySelector('#cycle-controls').textContent.includes('RETURN / NEW MATCH'),null,{timeout:5000});
 await page.screenshot({path:'test-results/multiplayer-restart-prompt.png'});
 await page.keyboard.press('Enter');
 await page.waitForFunction(r=>__tron.state.cycleRace.round>r,round,{timeout:10000});
 console.log(`Both humans on team ${teams[0]}. Round ${round}: Return blocked while a human was alive; once both humans were down, Return started round ${await page.evaluate(()=>__tron.state.cycleRace.round)}.`);
 assert.deepEqual(errors,[]);
}finally{socket?.close();await browser.close();}
