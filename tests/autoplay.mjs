import {CLU_AUTOPLAY_ENABLED} from '../src/game/autoplay.js';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];let calls=0,unavailable=false;
 page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:4,mode:'classic',small:false})));
 await page.route('**/api/jev/decision',r=>{calls++;if(unavailable)return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test service outage'})});const q=r.request().postDataJSON();assert.equal(q.controller,'clu');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:q.options[0].id,confidence:1})});});
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 if(!CLU_AUTOPLAY_ENABLED){
  assert.equal(await page.locator('#autoplay-toggle').isVisible(),false);
  assert.equal(await page.locator('#autoplay-toggle').isEnabled(),false);
  assert.equal(await page.locator('#jev-stats').isVisible(),false);
  for(const key of ['KeyU','Shift+KeyU']){
   await page.keyboard.press(key);
   assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
   assert.equal(await page.evaluate(()=>__tron.state.autoplay.manualFire),false);
  }
  await page.evaluate(()=>document.querySelector('#autoplay-toggle').dispatchEvent(new MouseEvent('click')));
  assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
  await page.waitForTimeout(500);assert.equal(calls,0);
  const zoom=()=>page.evaluate(()=>({follow:__tron.state.followZoom,aerial:__tron.state.aerialZoom}));
  const initialZoom=await zoom();
  for(const key of ['KeyK','KeyI']){await page.keyboard.down(key);await page.waitForTimeout(200);await page.keyboard.up(key);assert.deepEqual(await zoom(),initialZoom);}
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyK');await page.waitForTimeout(250);await page.keyboard.up('KeyK');
  const farther=await zoom();assert(farther.aerial>initialZoom.aerial);assert.equal(farther.follow,initialZoom.follow);
  await page.keyboard.down('KeyI');await page.waitForTimeout(150);await page.keyboard.up('KeyI');assert((await zoom()).aerial<farther.aerial);
  await page.keyboard.press('KeyV');const returned=await zoom();
  await page.keyboard.down('KeyK');await page.waitForTimeout(200);await page.keyboard.up('KeyK');assert.deepEqual(await zoom(),returned);
  await page.screenshot({path:'test-results/clu-autoplay-disabled.png'});
  assert.deepEqual(errors,[]);console.log('Clu autoplay unavailable through keys and button; autoplay and statistics UI hidden; no player API calls.');
 }else{
 // Real browser-default blueprint opening, after the pursuers are gone.
 await page.evaluate(()=>__tron.place({recognizers:[],enemyTanks:[]}));
 const opening=await page.evaluate(()=>({x:__tron.state.x,s:__tron.state.s}));
 await page.keyboard.press('u');await page.waitForFunction(()=>__tron.state.autoplay.plan?.kind==='collect-data');
 await page.waitForFunction(p=>Math.hypot(__tron.state.x-p.x,__tron.state.s-p.s)>40,opening);
 assert.equal(await page.evaluate(()=>__tron.state.autoplay.plan.kind),'collect-data');
 await page.keyboard.press('u');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,yaw:0,turretYaw:Math.PI/2,speed:0,recognizers:[],enemyTanks:[],dataBeams:[]}));
 assert.equal(await page.locator('#autoplay-toggle').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('Shift+KeyU');
 await page.waitForFunction(()=>__tron.state.autoplay.enabled&&__tron.state.autoplay.manualFire);
 await page.waitForFunction(()=>document.querySelector('#autoplay-toggle').textContent.includes('MANUAL FIRE'));
 assert.match(await page.locator('#autoplay-toggle').innerText(),/MANUAL FIRE/);
 const assistedStart=await page.evaluate(()=>({s:__tron.state.s,shots:__tron.state.shots}));
 await page.waitForFunction(s=>__tron.state.s>s+5,assistedStart.s);
 assert.equal(await page.evaluate(()=>__tron.state.shots),assistedStart.shots);
 await page.keyboard.press('Space');
 await page.waitForFunction(shots=>__tron.state.shots>shots,assistedStart.shots);
 assert.equal(await page.evaluate(()=>__tron.state.autoplay.manualFire),true);
 await page.keyboard.press('Shift+KeyU');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
 await page.keyboard.press('KeyU');assert.equal(await page.evaluate(()=>__tron.state.autoplay.manualFire),false);
 await page.keyboard.press('Shift+KeyU');assert.equal(await page.evaluate(()=>__tron.state.autoplay.manualFire),true);
 await page.keyboard.press('Shift+KeyU');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
 await page.keyboard.press('u');await page.waitForFunction(()=>__tron.state.autoplay.source==='jev');
 const before=await page.evaluate(()=>__tron.state.s);await page.waitForFunction(s=>__tron.state.s>s+12,before);assert(calls>0);assert.equal(await page.evaluate(()=>__tron.state.jevStats.requests),calls);assert.match(await page.locator('#jev-stats').innerText(),/REQUESTS.*\/s/i);assert.match(await page.locator('#jev-stats').innerText(),/USD/);
 await page.waitForFunction(()=>__tron.state.time>8&&Math.abs(__tron.state.turretYaw)<.03);
 const samples=[];for(let i=0;i<12;i++){samples.push(await page.evaluate(()=>__tron.state.speed));await page.waitForTimeout(250);}
 assert(Math.min(...samples)>19,`Cruise speed dropped: ${samples}`);
 await page.screenshot({path:'test-results/autoplay-jev.png'});
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>__tron.state.time),count=calls;await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__tron.state.time),paused);assert.equal(calls,count);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),true);
 const position=await page.evaluate(()=>__tron.state.s);
 await page.keyboard.down('Space');await page.waitForTimeout(300);await page.keyboard.up('Space');
 assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),true);
 assert(await page.evaluate(s=>__tron.state.s>s,position));
 await page.keyboard.down('s');await page.waitForTimeout(700);await page.keyboard.up('s');
 assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),true);
 const slow=await page.evaluate(()=>__tron.state.speed);await page.waitForTimeout(1000);
 assert(await page.evaluate(speed=>__tron.state.speed>speed,slow));
 await page.keyboard.press('Shift+W');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),true);
 await page.keyboard.press('u');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
 await page.click('#autoplay-toggle');assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),true);
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const backgroundStart=await page.evaluate(()=>({time:__tron.state.time,s:__tron.state.s}));
 await page.waitForTimeout(1800);
 const backgroundEnd=await page.evaluate(()=>__tron.state);
 assert.equal(backgroundEnd.mode,'running');assert(backgroundEnd.time>backgroundStart.time+1);assert(backgroundEnd.s>backgroundStart.s);
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>__tron.state.time);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>__tron.state.time),frozen);
 await page.keyboard.press('Escape');
 await page.keyboard.press('u');await page.waitForFunction(()=>__tron.state.mode==='paused');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
 await page.keyboard.press('Escape');await page.keyboard.press('u');
 unavailable=true;await page.waitForFunction(()=>!__tron.state.autoplay.enabled);
 assert.equal(await page.locator('#autoplay-toggle').getAttribute('aria-pressed'),'false');
 await page.waitForFunction(()=>document.body.textContent.includes('Autoplay disengaged'));
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__tron.state.autoplay.enabled),false);
 assert.deepEqual(errors,[]);console.log('Autoplay: U/button, accepted player decision, driving, pause, temporary manual override and U disable, background simulation, manual/pause behavior, service outage disengagement and visible warning, no JavaScript errors or paid requests.');
 }
}finally{await browser.close();}
