import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyW');
 const index=await page.evaluate(async()=>{
  const {freePosition,lineOfSight}=await import('/src/levels/maze.js'),r=__tron.state;
  for(const tank of r.enemyTanks.filter(e=>e.role==='patrol'))for(let a=0;a<Math.PI*2;a+=Math.PI/8){
   const p={x:tank.x-Math.sin(a)*20,s:tank.s+Math.cos(a)*20};
   if(!freePosition(p.x,p.s,4)||!lineOfSight({...tank,y:2.8},{...p,y:2.8}))continue;
   __tron.place({...p,yaw:a+Math.PI,speed:0,health:100,projectiles:[],recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:e===tank?'patrol':'destroyed',yaw:a+Math.PI,turretYaw:0,speed:0,vx:0,vs:0,nextSense:0,cooldown:0,memory:null,canSee:false}))});
   return tank.index;
  }
  throw Error('No clear close encounter in the blueprint');
 });
 await page.waitForFunction(i=>__tron.state.enemyTanks[i].canSee,index);
 await page.waitForFunction(()=>__tron.state.health<100);
 const state=await page.evaluate(()=>__tron.state);assert.equal(state.enemyTanks[index].state,'pursue');assert.deepEqual(errors,[]);
 console.log('Blueprint maze patrol notices Clu behind it, turns its turret, and lands a shot.');
}finally{await browser.close();}
