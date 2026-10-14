import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.on('data',c=>{if(c.toString().includes('Local:'))resolve();});server.on('exit',c=>reject(new Error(`Server exited ${c}`)));});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5180/?runSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,null,{timeout:120000});
 await page.locator('#start').click();await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(async()=>{
  const {browserScenario}=await import('/src/game/browser-scenario.js');const world=browserScenario(location).world;
  const edge=world.WALLS.flatMap(w=>w.edges).find(e=>Math.hypot(e.b.x-e.a.x,e.b.s-e.a.s)>40&&!world.wallAt((e.a.x+e.b.x)/2+e.nx*.1,(e.a.s+e.b.s)/2+e.ns*.1)&&world.freePosition((e.a.x+e.b.x)/2+e.nx*20,(e.a.s+e.b.s)/2+e.ns*20,8));
  const x=(edge.a.x+edge.b.x)/2,s=(edge.a.s+edge.b.s)/2;
  __tron.place({x:x+edge.nx*18,s:s+edge.ns*18,yaw:Math.atan2(edge.nx,-edge.ns),turretYaw:0,turretHeading:null,aimPitch:0,speed:50,turboRemaining:5,cruiseThrottle:false,enemyTanks:[],recognizers:[],projectiles:[]});
 });
 await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>__tron.state.barrelJam!==null,null,{timeout:15000});await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>__tron.state.wallDamage.cavities>0);
 const stuck=await page.evaluate(()=>({x:__tron.state.x,s:__tron.state.s}));
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>({x:__tron.state.x,s:__tron.state.s})),stuck);
 assert((await page.locator('#system-warnings').textContent()).includes('BARREL LODGED'));
 await page.screenshot({path:'test-results/turret-lodged.png'});
 await page.keyboard.down('KeyS');await page.waitForFunction(()=>__tron.state.barrelJam===null,null,{timeout:10000});await page.keyboard.up('KeyS');
 await page.screenshot({path:'test-results/turret-freed.png'});
 assert.deepEqual(errors,[]);console.log('Hard muzzle impact damages maze, lodges tank, shows hint and releases on reverse.');
}finally{await browser.close();server.kill();}
