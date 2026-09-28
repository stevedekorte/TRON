import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://127.0.0.1:5173/?layoutSeed=1982&cycleStart=1');
 await page.waitForFunction(()=>{try{return __tron.state.playerVehicle==='cycle'&&__tron.state.mode==='running';}catch{return false;}},{},{timeout:60000});
 await page.evaluate(async()=>{
  const {GameSession}=await import('/src/simulation/game-session.js');
  const original=GameSession.prototype.advance;
  window.stepTimings=[];GameSession.prototype.advance=function(...args){const t=performance.now();const result=original.apply(this,args);stepTimings.push(performance.now()-t);return result;};
  const r=__tron.state;const bike=r.cycleRace.cycles[1];bike.roadSpeed=20;bike.targetRoadSpeed=20;
  __tron.place({cycleRace:r.cycleRace,inspection:true});
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
 const results=[];
 for(const mode of ['alive','dead']){
  if(mode==='dead')await page.evaluate(()=>{const r=__tron.state;r.cycleRace.cycles[1].alive=false;__tron.place({cycleRace:r.cycleRace});});
  await page.waitForTimeout(500);await page.evaluate(()=>{stepTimings=[];window.frameDeltas=[];let last=performance.now();window.profileFrames=true;const record=t=>{frameDeltas.push(t-last);last=t;if(profileFrames)requestAnimationFrame(record);};requestAnimationFrame(record);});
  await cdp.send('Profiler.start');await page.waitForTimeout(5000);const {profile}=await cdp.send('Profiler.stop');
  const metrics=await page.evaluate(()=>{profileFrames=false;const stats=a=>{a=a.filter(n=>n>=0).sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],total:a.reduce((s,x)=>s+x,0)};};return {frames:stats(frameDeltas),simulation:stats(stepTimings),alive:__tron.state.cycleRace.cycles[1].alive};});
  const byId=new Map(profile.nodes.map(n=>[n.id,n]));const sums=new Map();
  for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]);const key=n.callFrame.functionName+' '+n.callFrame.url.split('/').slice(-2).join('/');sums.set(key,(sums.get(key)||0)+profile.timeDeltas[i]/1000);}
  results.push({mode,...metrics,hotspots:[...sums].sort((a,b)=>b[1]-a[1]).slice(0,18)});
  await fs.writeFile(`test-results/cycle-${mode}.cpuprofile`,JSON.stringify(profile));
 }
 await fs.writeFile('test-results/cycle-performance.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
