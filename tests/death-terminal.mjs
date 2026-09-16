import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.up('KeyW');await page.evaluate(()=>{const r=__tron.state;__tron.place({x:-5000,s:-5000,speed:0,health:1,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'})),projectiles:[{x:-5000,y:2.3,s:-5003.6,vx:0,vs:165,vy:0,life:2,faction:'enemy',owner:100}]});});
 await page.waitForFunction(()=>__tron.state.crushed);assert.equal(await page.evaluate(()=>__tron.state.mode),'running');
 await page.waitForTimeout(450);const early=await page.evaluate(()=>__tron.state.music);assert.ok(!early.paused&&early.gain>0&&early.gain<.55);
 await page.waitForFunction(()=>!document.querySelector('#death-fade').hidden);const late=await page.evaluate(()=>__tron.state.music);assert.ok(!late.paused&&late.gain<early.gain); const alpha=await page.locator('#death-fade').evaluate(e=>Number(e.style.opacity));assert.ok(alpha>0&&alpha<1);
 await page.waitForFunction(()=>__tron.state.mode==='ready');await page.waitForTimeout(600);await page.waitForFunction(()=>__tron.state.music.track==='terminal'&&!__tron.state.music.paused&&__tron.state.music.time>0);assert.ok(decodeURIComponent(await page.evaluate(()=>__tron.state.music.src)).includes('Only Solutions'));
 assert.equal(await page.locator('#terminal-text').textContent(),'ILLEGAL CODE\nCLU PROGRAM DETACHED FROM SYSTEM');assert.equal(await page.locator('#hud').isVisible(),false);assert.equal(await page.locator('.terminal-cursor').isVisible(),false);
 assert.equal(await page.locator('#game').evaluate(e=>getComputedStyle(e).visibility),'hidden');await page.screenshot({path:'test-results/death-terminal.png'});
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='entering');assert.equal(await page.evaluate(()=>__tron.state.crushed),false);await page.waitForFunction(()=>__tron.state.mode==='running');assert.equal(await page.locator('#death-fade').isVisible(),false);assert.ok(Math.abs(await page.evaluate(()=>__tron.state.music.gain)-.55)<1e-6);assert.equal(await page.evaluate(()=>__tron.state.music.track),'gameplay');assert.ok(decodeURIComponent(await page.evaluate(()=>__tron.state.music.src)).includes("We've Got Company"));assert.deepEqual(errors,[]);
 console.log('Fatal hit shows breakup, fades to film terminal message, and Return starts a fresh run.');
}finally{await browser.close();}
