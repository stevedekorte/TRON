import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(120000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(()=>{
  const e=__tron.state.recognizers[0];
  Object.assign(e,{x:-5000,s:-5060,y:80,yaw:0,yawVelocity:0,vx:0,vs:29.7,vy:0,memory:null,canSee:false,attack:null,spotlight:null,nextSense:0,nextAttack:0,goal:null});
  __tron.place({x:-5000,s:-5000,yaw:0,speed:22,cruiseThrottle:true,recognizers:[e],enemyTanks:[],radio:[]});
  if(globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches)__tron.configure({renderScale:.5});
 });
 await page.waitForFunction(()=>__tron.state.recognizers[0].attack?.phase==='fold');
 const strike=await page.evaluate(()=>{const r=__tron.state,e=r.recognizers[0];return {lead:e.s-r.s,phase:e.attack.phase,target:e.attack.target};});
 assert.ok(strike.lead>0,'Recognizer must overtake Clu before committing: '+JSON.stringify(strike));
 await page.screenshot({path:'test-results/recognizer-intercept-fold.png'});
 await page.waitForFunction(()=>__tron.state.crushed);
 await page.screenshot({path:'test-results/recognizer-intercept-impact.png'});
 assert.deepEqual(errors,[]);console.log({strike,crushed:true});
}finally{await browser.close();}
