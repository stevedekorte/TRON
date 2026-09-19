import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>window.__tron.state.mode==='ready');
 await page.keyboard.press('Enter');await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('KeyP');await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');
 await page.evaluate(()=>{const r=__tron.state;__tron.place({speed:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});});
 await page.waitForTimeout(1000);await page.screenshot({path:'test-results/maze-distance.png'});
 await page.waitForFunction(()=>['data-ring-close','data-ring-open'].every(k=>__tron.state.audioSamples.includes(k)));
 const count=await page.evaluate(()=>__tron.state.dataBeams.length);assert.equal(count,4);
 for(let i=0;i<count;i++){
  await page.evaluate(async i=>{
   const {freePosition,lineOfSight}=await import('/src/levels/maze.js');const b=__tron.state.dataBeams[i];let p;
   for(let j=0;j<32;j++){const a=j*Math.PI/16,q={x:b.x+Math.sin(a)*16,s:b.s-Math.cos(a)*16};if(freePosition(q.x,q.s,4)&&lineOfSight({...q,y:3},{...b,y:3})){p={...q,yaw:a};break;}}
   if(!p)throw Error('No clear beam approach');__tron.place({...p,turretYaw:0,speed:0});
  },i);
  await page.waitForTimeout(900);
  if(i===0)await page.screenshot({path:'test-results/data-beam.png'});
  await page.evaluate(i=>{const b=__tron.state.dataBeams[i];__tron.place({x:b.x,s:b.s,speed:0});},i);
  await page.waitForFunction(i=>__tron.state.dataBeams[i].transferStartedAt!==null,i);
  if(i===0){await page.waitForTimeout(1700);await page.screenshot({path:'test-results/data-transfer.png'});assert.equal(await page.evaluate(()=>__tron.state.dataCollected),0);}
  await page.waitForFunction(i=>__tron.state.dataBeams[i].collectedAt!==null,i);
  await page.waitForFunction(i=>__tron.state.beamVisuals[i].color===0x168aff,i);
  assert.equal(await page.evaluate(i=>__tron.state.beamVisuals[i].visible,i),true);
  assert.equal(await page.evaluate(i=>__tron.state.beamVisuals[i].curtain,i),false);
  if(i===0)await page.screenshot({path:'test-results/data-beam-shutdown.png'});

 }
 assert.equal(await page.evaluate(()=>__tron.state.dataCollected),4);
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(()=>__tron.state.dataCollected===0);
 assert.equal(await page.evaluate(()=>__tron.state.dataBeams.every(b=>b.collectedAt===null)),true);
 assert.deepEqual(errors,[]);console.log('Four maze beams render, collect once, remain blue independently, and reset without browser errors.');
}finally{await browser.close();}
