// First-person grid turns sweep to the new heading over ~0.14 s with a brief
// bank, instead of cutting instantly.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:120000});
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.camera.cycleFirstPersonMix>.97,null,{timeout:10000});
 // Sample camera yaw/roll every animation frame across a right turn.
 const samples=await page.evaluate(async()=>{
  // Euler YXZ (yaw, pitch, roll) from the camera quaternion.
  const out=[],q=()=>__tron.state.camera.rotation,yawRoll=([x,y,z,w])=>({
   yaw:Math.atan2(2*(x*z+w*y),1-2*(x*x+y*y)),roll:Math.atan2(2*(x*y+w*z),1-2*(x*x+z*z))});
  const t0=performance.now();
  await new Promise(r=>requestAnimationFrame(r));
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',key:'ArrowRight',bubbles:true}));
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight',key:'ArrowRight',bubbles:true}));
  for(let i=0;i<70;i++){await new Promise(r=>requestAnimationFrame(r));out.push({t:performance.now()-t0,...yawRoll(q())});}
  return out;
 });
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),y0=samples[0].yaw,total=wrap(samples.at(-1).yaw-y0);
 const steps=samples.slice(1).map((s,i)=>Math.abs(wrap(s.yaw-samples[i].yaw)));
 const maxRoll=Math.max(...samples.map(s=>Math.abs(s.roll)));
 const inBetween=samples.filter(s=>{const d=Math.abs(wrap(s.yaw-y0));return d>.15&&d<Math.abs(total)-.15;}).length;
 console.log({totalDegrees:(total*180/Math.PI).toFixed(1),largestFrameStepDegrees:(Math.max(...steps)*180/Math.PI).toFixed(1),framesMidSweep:inBetween,maxRollDegrees:(maxRoll*180/Math.PI).toFixed(1)});
 assert(Math.abs(Math.abs(total)-Math.PI/2)<.1,'turned 90°');
 assert(inBetween>=3,'several frames between the old and new heading');
 assert(Math.max(...steps)<Math.PI/4,'no instant cut');
 assert(maxRoll>.03&&maxRoll<.15,'brief bank into the turn');
 assert(Math.abs(samples.at(-1).roll)<.01,'level after the turn');
 assert.deepEqual(errors,[]);
 console.log('First-person turn sweeps with a brief bank.');
}finally{await browser.close();}
