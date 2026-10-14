import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__tron.state.mode==='running');await page.keyboard.press('Escape');
 await page.evaluate(()=>__tron.place({gunner:true}));await page.waitForTimeout(300);
 let baseline=await page.evaluate(()=>window.__tron.state.renderer.geometries);
 async function destroy(){
  await page.evaluate(()=>{
   const recognizers=window.__tron.state.recognizers.map((e,i)=>({...e,x:-1800,s:-1720,y:80,yaw:0,vx:0,vs:0,vy:0,formation:null,state:i?'destroyed':'wander',health:1,attack:null,fold:0,memory:null,canSee:false}));
   window.__tron.place({x:-1800,s:-1800,yaw:0,turretYaw:0,speed:0,gunner:true,gunnerZoom:0,aimPitch:.76,crushed:false,recognizers,projectiles:[{x:-1800,s:-1720,y:80,vx:0,vs:0,vy:0,life:1}]});
  });
  await page.waitForTimeout(900);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.breakups.length===1);
  await page.waitForTimeout(180);
  return page.evaluate(()=>window.__tron.state.breakups[0]);
 }
 const first=await destroy();assert.equal(first.pieces.length,15);
 assert.equal(first.pieces.filter(p=>!p.fragmented).length,15);
 assert.equal(new Set(first.pieces.map(p=>p.part)).size,15);
 assert.ok(first.pieces.every(p=>p.part.startsWith('block-')));
 await page.screenshot({path:'test-results/recognizer-breakup-early.png'});
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>window.__tron.state.breakups);
 await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__tron.state.breakups),frozen);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.breakups.length===0);
 baseline=await page.evaluate(()=>__tron.state.renderer.geometries);await page.keyboard.press('Escape');
 const second=await destroy();assert.notDeepEqual(second.pieces,first.pieces);
 await page.waitForFunction(()=>window.__tron.state.breakups[0]?.age>4);const falling=await page.evaluate(()=>window.__tron.state.breakups[0]);
 assert.ok(falling.pieces.some((p,i)=>p.y<second.pieces[i].y-10),JSON.stringify({second,falling}));
 await page.screenshot({path:'test-results/recognizer-breakup-falling.png'});
 await page.waitForFunction(()=>window.__tron.state.breakups.length===0,{},{timeout:15000});
 const remaining=await page.evaluate(()=>window.__tron.state.renderer.geometries);assert.ok(remaining<=baseline+1,JSON.stringify({baseline,remaining}));
 assert.deepEqual(errors,[]);console.log('Fifteen connected Recognizer blocks vary per destruction, tumble/fall, freeze on pause and release geometry after expiry.');
}finally{await browser.close();}
