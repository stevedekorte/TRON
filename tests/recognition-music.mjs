import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>{const r=__tron.state;__tron.configure({enemySpeed:0});__tron.place({x:-5000,s:-5000,speed:0,enemyTanks:[],recognizers:r.recognizers.map((e,i)=>({...e,x:-5000,s:-5600,y:75,yaw:0,vx:0,vs:0,state:i?'destroyed':'wander',canSee:false,memory:null,spotlight:null,alertUntil:0,nextSense:0,nextAttack:Infinity,targetGone:false}))});});
 await page.waitForFunction(()=>__tron.state.recognizers[0].canSee);
 await page.waitForFunction(()=>__tron.state.music.category==='pursued',{},{timeout:45000});
 const music=await page.evaluate(()=>__tron.state.music);assert.equal(music.loop,false);assert.equal(music.paused,false);assert.equal(music.track,'gameplay');assert.equal(music.error,null);
 await page.evaluate(()=>{const r=__tron.state;__tron.place({recognizers:r.recognizers.map((e,i)=>({...e,x:r.x,s:r.s-40,y:70,state:i?'destroyed':'pursue',canSee:true,nextSense:Infinity,nextAttack:Infinity,memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:r.time,source:e.id}}))});});
 await page.waitForFunction(()=>__tron.state.music.transition==='gotcha');
 const before=await page.evaluate(()=>__tron.state.music.gain);await page.waitForTimeout(150);const during=await page.evaluate(()=>__tron.state.music);assert.ok(during.gain<before);assert.equal(during.category,'pursued');
 await page.waitForFunction(()=>__tron.state.music.category==='gotcha'&&!__tron.state.music.paused&&__tron.state.music.time>0);await page.waitForTimeout(400);
 assert.ok(await page.evaluate(()=>__tron.state.music.gain)>.5);assert.equal(await page.evaluate(()=>__tron.state.music.loop),false);
 await page.evaluate(()=>{const r=__tron.state;__tron.place({recognizers:r.recognizers.map(e=>({...e,state:'destroyed',canSee:false})),enemyTanks:[]});});
 await page.waitForFunction(()=>__tron.state.music.transition==='silence');
 const initial=await page.evaluate(()=>__tron.state.music.gain);await page.waitForTimeout(1000);
 const fading=await page.evaluate(()=>__tron.state.music);assert.equal(fading.paused,false);assert.ok(fading.gain>initial*.4&&fading.gain<initial*.85);
 await page.waitForFunction(()=>__tron.state.music.paused&&__tron.state.music.gain===0);
 await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__tron.state.music.paused),true);
 console.log('Three-second fade to silence passes.');
 console.log('Recognition opener leads to pursuit; close aircraft fades pursuit out and starts a once-only gotcha cue.');
}finally{await browser.close();}
