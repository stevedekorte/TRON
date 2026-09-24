import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const approaching=process.argv.includes('--approaching');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/decision',route=>{
  const snapshot=route.request().postDataJSON();
  const choice=snapshot.options.find(o=>o.kind==='low-approach')||snapshot.options.find(o=>o.kind==='pursue')||snapshot.options[0];
  return route.fulfill({contentType:'application/json',body:JSON.stringify({id:choice.id,confidence:1})});
 });
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 if(approaching){
  await page.evaluate(()=>{
   const e=__tron.state.recognizers[0];
   Object.assign(e,{x:-9980,s:-9860,y:80,yaw:Math.PI,vx:0,vs:0,vy:0,yawVelocity:0,tactical:null,attackAssignment:null,memory:null,canSee:false,nextSense:0});
   __tron.place({x:-10000,s:-10000,yaw:0,speed:22,cruiseThrottle:true,recognizers:[e],enemyTanks:[],dataBeams:[]});
  });
  await page.waitForFunction(()=>__tron.state.recognizers[0].attack?.phase==='fold',{},{timeout:30000});
  assert.ok(await page.evaluate(()=>__tron.state.recognizers[0].s-__tron.state.s>35),'fold ahead of approaching Clu');
 }else{
  await page.keyboard.press('s');
  await page.evaluate(()=>__tron.place({cruiseThrottle:false,speed:0}));
 }
 await page.keyboard.press('v');
 try{await page.waitForFunction(()=>__tron.state.recognizers.some(e=>e.attack?.phase==='drop'),{},{timeout:60000});}catch(error){console.log(await page.evaluate(()=>({time:__tron.state.time,speed:__tron.state.speed,units:__tron.state.recognizers.slice(0,5).map(e=>({d:Math.hypot(e.x-__tron.state.x,e.s-__tron.state.s),state:e.state,kind:e.tactical?.plan?.kind,role:e.attackAssignment?.role}))})));throw error;}
 await page.screenshot({path:approaching?'test-results/approaching-stomp.png':'test-results/opening-stomp.png'});
 await page.waitForFunction(()=>__tron.state.crushed,{},{timeout:10000});
 const state=await page.evaluate(()=>__tron.state),attacker=state.recognizers.find(e=>e.attack?.phase==='hold');
 assert.ok(attacker);assert.equal(attacker.health,3);assert.ok(state.aiHistory.some(h=>h.accepted));assert.deepEqual(errors,[]);
 console.log('Rendered opening stomp with accepted simulated JEV responses:',state.time,'seconds; attacker health:',attacker.health);
}finally{await browser.close();}
