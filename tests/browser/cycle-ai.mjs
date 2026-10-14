import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/jev/**',route=>route.fulfill({status:503,body:'{}'}));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.mode==='running'&&__tron.state.playerVehicle==='cycle',null,{timeout:60000});
 await page.evaluate(()=>__tron.configureCycleAI({measure:true}));
 await page.waitForFunction(()=>__tron.cycleAI?.tick>120,null,{timeout:30000});
 const state=await page.evaluate(()=>({debug:__tron.cycleAI,metrics:__tron.state.cycleRace.aiMetrics}));
 assert(state.debug.bots.length>0);assert(state.debug.bots.every(b=>b.decisions>0));
 await page.keyboard.press('Tab');
 await page.locator('summary').filter({hasText:'Arena AI'}).click();
 const weight=page.getByLabel('AI cutoff',{exact:true});await weight.fill('2.6');await weight.dispatchEvent('change');
 assert.equal(await page.evaluate(()=>__tron.state.cycleRace.aiPolicy.cutoff),2.6);
 await page.locator('#cycle-tuning [data-close]').click();
 await page.waitForTimeout(1000);
 const frameAI=await page.evaluate(()=>new Promise(resolve=>{
  const values=[];let previous=__tron.cycleAI.totalMilliseconds,started=performance.now();
  function sample(){const total=__tron.cycleAI.totalMilliseconds;values.push(Math.max(0,total-previous));previous=total;if(performance.now()-started<8000)requestAnimationFrame(sample);else{values.sort((a,b)=>a-b);resolve({frames:values.length,p99:values[Math.floor(values.length*.99)],max:values.at(-1)});}}
  requestAnimationFrame(sample);
 }));
 assert(frameAI.p99<1,'AI work per rendered frame stays under 1 ms');
 await page.screenshot({path:'test-results/cycle-ai-arena.png'});
 // Browser CPU-only stress, isolated from the animation loop; includes geometry.
 const report=await page.evaluate(async()=>{
  const {resetCycleRound,updateCycleRace}=await import('/shared/simulation/light-cycles.js');
  const {planCycleAI}=await import('/shared/simulation/cycle-ai/controller.js');
  const r={site:{x:0,s:0},seed:1982,round:0,scores:[0,0,0,0],time:0,teamCount:4,cyclesPerTeam:3,closedArena:true,startWithBreach:false,hideMiddleOpponent:false};
  resetCycleRound(r);r.remaining=0;updateCycleRace(r,1/120);r.trails=[];
  for(let i=0;i<2048;i++){const x=i%64*2.5-80,z=Math.floor(i/64)*5-80;r.trails.push({bikeId:i%12,x1:x,z1:z,x2:x+1,z2:z});}
  const samples=[];
  for(let i=0;i<1000;i++){r.time+=1/120;r.elapsed+=1/120;const t=performance.now();planCycleAI(r);if(i>100)samples.push(performance.now()-t);}
  samples.sort((a,b)=>a-b);return {browser:navigator.userAgent,p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],max:samples.at(-1)};
 });
 assert(report.p99<1,'dense browser AI p99 under 1 ms');assert.deepEqual(errors,[]);
 await writeFile('test-results/cycle-ai-browser.json',JSON.stringify({state,frameAI,report,errors},null,2));console.log(JSON.stringify({state,frameAI,report,errors}));
}finally{await browser.close();}
