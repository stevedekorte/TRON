import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('status of 503'))errors.push(m.text());});
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/?runSeed=1982');await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:120000});await page.locator('#start').click();
 await page.keyboard.press('Enter');await page.keyboard.press('KeyW');
 await page.waitForFunction(()=>__tron.state.mode==='running',null,{timeout:120000});
 await page.evaluate(async()=>{
  const {browserScenario}=await import('/src/game/browser-scenario.js');const world=browserScenario(location).world;
  const edge=world.WALLS.flatMap(w=>w.edges).find(e=>Math.hypot(e.b.x-e.a.x,e.b.s-e.a.s)>40&&!world.wallAt((e.a.x+e.b.x)/2+e.nx*.1,(e.a.s+e.b.s)/2+e.ns*.1)&&world.freePosition((e.a.x+e.b.x)/2+e.nx*20,(e.a.s+e.b.s)/2+e.ns*20,8));
  const x=(edge.a.x+edge.b.x)/2,s=(edge.a.s+edge.b.s)/2;window.impact={x,s,nx:edge.nx,ns:edge.ns};
  __tron.place({x:x+edge.nx*14,s:s+edge.ns*14,yaw:Math.atan2(edge.nx,-edge.ns),turretYaw:0,aimPitch:0,speed:0,cruiseThrottle:false,enemyTanks:[],recognizers:[],projectiles:[]});
 });
 await page.waitForTimeout(1800);
 const hit=async()=>page.keyboard.press('Space');
 await hit();await page.waitForFunction(()=>__tron.state.wallDamage.cavities===1);await page.waitForTimeout(150);
 await page.screenshot({path:'test-results/maze-wall-damage-impact.png'});
 const initialRadius=await page.evaluate(()=>__tron.state.wallDamage.radii[0]);
 for(let i=0;i<3;i++){await hit();await page.waitForTimeout(150);}
 await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>__tron.state.wallDamage.fragments),0);assert.equal(await page.evaluate(()=>__tron.state.wallDamage.cavities),1);
 assert((await page.evaluate(()=>__tron.state.wallDamage.radii[0]))>initialRadius);
 await page.screenshot({path:'test-results/maze-wall-damage-settled.png'});assert.deepEqual(errors,[]);console.log(await page.evaluate(()=>__tron.state.wallDamage));
 await page.keyboard.down('KeyW');await page.keyboard.press('KeyT');await page.waitForFunction(()=>__tron.state.turboRemaining>0);
 await page.keyboard.up('KeyW');await page.waitForFunction(()=>__tron.state.turboRemaining===0);assert((await page.evaluate(()=>__tron.state.turboCooldown))<60);
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(()=>__tron.state.wallDamage.cavities===0);
}finally{await browser.close();}
