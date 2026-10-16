import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.loadingFrames=[];
  function sample(now){
   const loading=document.querySelector('#loading'),dots=document.querySelectorAll('.loading-dots span');
   if(loading&&!loading.hidden&&dots.length)loadingFrames.push({now,dots:[...dots].map(d=>getComputedStyle(d).opacity).join(',')});
   if(!loading||!loading.hidden)requestAnimationFrame(sample);
  }requestAnimationFrame(sample);
 });
 for(let i=0;i<2;i++){
  if(i)await page.reload();else await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.tronLoadingReport?.().includes('Opening terminal ready'),null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const frames=loadingFrames,begin=performance.getEntriesByName('tron:assets-ready')[0].startTime,end=performance.getEntriesByName('tron:world-ready')[0].startTime;
   return {loadingFrames:frames.length,dotStates:[...new Set(frames.map(f=>f.dots))],worldBuildFrames:frames.filter(f=>f.now>=begin&&f.now<=end).length,timings:tronLoadingReport()};
  });
  assert(report.loadingFrames>15,'loading UI continues to receive animation frames');
  assert(report.dotStates.length>1,'loading dots animate');
  assert(report.worldBuildFrames>=5,'world construction yields repeatedly for UI painting');
  reports.push({navigation:i?'cached reload':'first navigation',...report});
 }
 await page.locator('#start-cycles').click();await page.waitForFunction(()=>__tron.state.mode==='running'&&__tron.state.playerVehicle==='cycle',null,{timeout:60000});
 assert.deepEqual(errors,[]);await writeFile('test-results/loading-responsive.json',JSON.stringify({reports,errors},null,2));
 console.log(JSON.stringify(reports.map(({timings,...r})=>r)));
}finally{await browser.close();}
