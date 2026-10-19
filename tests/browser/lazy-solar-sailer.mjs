import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const button of ['start','start-cycles','start-multiplayer']){
  const page=await browser.newPage({reducedMotion:'reduce'}),requests=[],errors=[];
  page.on('request',r=>{if(/rendering\/solar-sailer\.js|tron_1982_solar_sailer.*glb/.test(r.url()))requests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5188/?layoutSeed=1982&runSeed=1982');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled,null,{timeout:120000});
  assert.equal(requests.length,0,'boot must not request the Solar Sailer');
  await page.locator('#'+button).click();
  await page.waitForFunction(()=>__tron.state.mode==='running',null,{timeout:60000});
  assert.equal(requests.length,0,'program entry must not request optional scenery');
  if(button!=='start')await page.waitForFunction(()=>__tron.state.cycleOpening===null&&__tron.state.cycleRace.phase==='racing',null,{timeout:60000});
  await page.evaluate(async()=>{window.sailerFrames=[];window.trackSailer=true;function sample(t){sailerFrames.push(t);if(trackSailer)requestAnimationFrame(sample)}requestAnimationFrame(sample);const {SOLAR_SAILER}=await import('/src/game/solar-sailer.js');SOLAR_SAILER.backgroundLoadSeconds=0;});
  await page.waitForFunction(()=>tronLoadingReport().includes('Solar sailer module + model'),null,{timeout:30000});
  assert(requests.some(u=>u.includes('glb')));assert.equal(requests.filter(u=>u.includes('glb')&&!new URL(u).search).length,1);
  await page.waitForTimeout(300);const gaps=await page.evaluate(()=>{trackSailer=false;return sailerFrames.slice(1).map((t,i)=>t-sailerFrames[i]);});assert.deepEqual(errors,[]);console.log(button+': no boot/entry load; scenery loaded once during play; max frame gap '+Math.max(...gaps).toFixed(1)+' ms');
  await page.close();
 }
}finally{await browser.close();}
