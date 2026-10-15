import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const browser=await chromium.launch({channel:'chrome',headless:true});
const sockets=[],deliveryTimers=new Set();
const base=process.env.TRON_URL||'http://127.0.0.1:5173/';
const socketUrl=new URL('/api/multiplayer?v=1',base);socketUrl.protocol=socketUrl.protocol==='https:'?'wss:':'ws:';
try{
 const context=await browser.newContext({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[],requests=[];
 if(process.env.TRON_MP_JITTER==='1')await context.routeWebSocket('**/api/multiplayer*',socket=>{
  const server=socket.connectToServer();let sequence=0,lastDue=0;
  const transit=Number(process.env.TRON_MP_LATENCY_MS||0);
  if(transit)socket.onMessage(message=>{
   const timer=setTimeout(()=>{deliveryTimers.delete(timer);server.send(message);},transit);deliveryTimers.add(timer);
  });
  server.onMessage(message=>{
   const delay=transit+[20,50,15,45,25,40][sequence++%6],due=Math.max(lastDue+1,Date.now()+delay);lastDue=due;
   const timer=setTimeout(()=>{deliveryTimers.delete(timer);socket.send(message);},Math.max(0,due-Date.now()));deliveryTimers.add(timer);
  });
 });
 await context.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 const packets=[];
 const page=await context.newPage();
 page.on('websocket',socket=>socket.on('framereceived',({payload})=>{try{const message=JSON.parse(String(payload));if(message.type==='state')packets.push(message);}catch{}}));page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('request',r=>requests.push(r.url()));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled);
 assert(!requests.some(url=>url.includes('/src/multiplayer/')),'no multiplayer client loaded at home');
 assert(!requests.some(url=>url.includes('cloud.glb')),'grid cloud is not downloaded');
 await page.locator('#start-multiplayer').click();
 try{await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle'&&__tron.state.cycleRace?.cycles.length>=6,null,{timeout:30000});}catch(e){console.log(await page.locator('#error-message').textContent());throw e;}
 await page.waitForFunction(()=>__tron.state.mode==='running'&&!document.body.classList.contains('home-transition'));
 const soloRound=await page.evaluate(()=>__tron.state.cycleRace.round);
 await page.keyboard.press('Enter');
 await page.waitForFunction(round=>__tron.state.cycleRace.round>round&&__tron.state.cycleRace.phase==='racing',soloRound);
 const restartedRound=await page.evaluate(()=>__tron.state.cycleRace.round);
 await page.keyboard.press('NumpadEnter');
 await page.waitForFunction(round=>__tron.state.cycleRace.round>round&&__tron.state.cycleRace.phase==='racing',restartedRound);
 assert((await page.locator('#cycle-controls').textContent()).includes('RETURN / NEW MATCH'));
 await page.screenshot({path:'test-results/multiplayer-player.png'});
 await page.waitForFunction(()=>__tron.state.mode==='running'&&!document.body.classList.contains('home-transition'));
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>__tron.state.mode),'running','MP does not pause on blur');
 assert(await page.locator('#paused').isHidden());
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));
 await second.goto(base);await second.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled);
 await second.locator('#start-multiplayer').click();await second.waitForFunction(()=>__tron.state.playerVehicle==='cycle',null,{timeout:60000});
 // Real wire clients fill remaining seats; new participants spectate until the next match.
 for(let i=0;i<12;i++)await new Promise((resolve,reject)=>{
  const socket=new WebSocket(socketUrl,{origin:new URL(base).origin});sockets.push(socket);
  socket.once('error',reject);socket.on('message',raw=>{const d=JSON.parse(raw);if(d.type==='welcome'){socket.playerId=d.id;}if(d.type==='state'){socket.latest=d;resolve();}});
 });
 assert(sockets.some(s=>s.latest.clients.find(c=>c.id===s.playerId)?.queue>0),'overflow users wait');
 const state=sockets.at(-1).latest;assert(state.race.cycles.length<=12);assert.equal(state.race.cyclesPerTeam,3);assert.equal(state.clients.length,14);
 await page.bringToFront();
 assert.equal(await page.evaluate(()=>__tron.state.mode),'running');
 const status=await page.locator('#cycle-controls').boundingBox(),hint=await page.locator('#controls-prompt').boundingBox();
 if(status&&hint)assert(hint.y>=status.y+status.height,'controls hint is below MP status');
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing',null,{timeout:15000});
 const before=await page.evaluate(()=>({round:__tron.state.cycleRace.round,player:__tron.state.cycleRace.playerId}));
 await page.keyboard.press('Enter');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.round),before.round,'Return cannot reset the public match');
 await page.screenshot({path:'test-results/multiplayer-racing.png'});
 await page.evaluate(()=>__tron.setCycleRenderer('normal'));await page.waitForTimeout(250);
 await page.screenshot({path:'test-results/multiplayer-normal.png'});
 assert(await page.locator('.cycle-roster-icon.human').count()>0,'human players have roster stripes');
 assert.equal(await page.locator('.human-cycle-marker').count(),0,'no floating human markers');
 assert(packets.some(p=>p.protocol===2&&p.compact&&!p.full),'browser receives compact field deltas');
 assert(packets.every(p=>!JSON.stringify(p).includes('reactionTiming')),'AI internals stay on the server');
 assert.deepEqual(errors,[]);console.log('Two rendered clients share a 12-cycle arena; 14 connections, spectator queue, no cloud request, no eager MP client, and no local match reset.');
}finally{for(const timer of deliveryTimers)clearTimeout(timer);for(const s of sockets)s.close();await browser.close();}
