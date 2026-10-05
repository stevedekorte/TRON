import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:750},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:60000});
 await page.evaluate(()=>{
  const r=__tron.state,race=r.cycleRace;race.trails=[];race.occupied.fill(0);race.outerOccupied={};race.crashes=[];race.pendingTurns=[];race.phase='racing';race.arenaPaused=false;race.elapsed=0;
  for(const b of race.cycles)Object.assign(b,{alive:true,escaped:false,continuousArena:true,trailStopped:false,x:30+b.id*8,z:20,previousX:30+b.id*8,previousZ:20,dir:0,progress:1,speedMultiplier:1,nextReactionAt:Infinity,segment:undefined,yaw:undefined});
  const b=race.cycles[race.playerId];Object.assign(b,{x:.37,previousX:.37,z:.23,previousZ:.23});
  __tron.place({cycleRace:race});
  window.addEventListener('keydown',e=>{if(e.code==='KeyD'){
   const race=__tron.state.cycleRace,b=race.cycles[race.playerId];window.turnStart={x:b.x,z:b.z,time:race.time,turns:b.turns};
  }},true);
 });
 await page.keyboard.press('KeyD');
 await page.waitForFunction(()=>__tron.state.cycleRace.cycles[__tron.state.cycleRace.playerId].dir===1);
 const result=await page.evaluate(()=>{
  const race=__tron.state.cycleRace,b=race.cycles[race.playerId],trail=race.trails.find(t=>t.bikeId===b.id&&t.dir===1);
  return {start:turnStart,corner:trail&&{x:trail.x1,z:trail.z1},alive:b.alive,dir:b.dir,turns:b.turns};
 });
 assert(result.alive);assert.equal(result.turns,result.start.turns+1);
 assert(Math.abs(result.corner.x-result.start.x)<1e-8);assert(Math.abs(result.corner.z-result.start.z)<1e-8);
 await page.screenshot({path:'test-results/cycle-immediate-turn.png'});
 assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
