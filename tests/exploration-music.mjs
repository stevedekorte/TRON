import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Original=window.Audio;window.Audio=class extends Original{constructor(...args){super(...args);window.testMusic=this;}};});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(()=>{const r=__tron.state,b=r.dataBeams[0];__tron.place({dataBeams:r.dataBeams.map(b=>({...b,collectedAt:0}))});__tron.place({x:b.x,s:b.s,speed:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});});await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>__tron.state.music.category==='exploration'&&!__tron.state.music.paused);
 assert.equal(await page.evaluate(()=>testMusic.loop),false);
 await page.waitForFunction(()=>Number.isFinite(testMusic.duration)&&testMusic.duration>0);await page.evaluate(()=>{testMusic.currentTime=testMusic.duration-.05;});await page.waitForFunction(()=>testMusic.ended||testMusic.paused);
 await page.evaluate(()=>{const r=__tron.state;window.testBeam=r.dataBeams[0];__tron.place({x:r.x+10000,speed:0});});await page.waitForTimeout(500);
 await page.evaluate(()=>__tron.place({x:testBeam.x,s:testBeam.s,speed:0}));await page.waitForTimeout(2500);assert.equal(await page.evaluate(()=>testMusic.ended||testMusic.paused),true);
 await page.evaluate(()=>__tron.reset());await page.keyboard.press('KeyP');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.evaluate(()=>{const r=__tron.state,b=r.dataBeams[1];__tron.place({dataBeams:r.dataBeams.map(b=>({...b,collectedAt:0}))});__tron.place({x:b.x,s:b.s,speed:0,recognizers:r.recognizers.map(e=>({...e,state:'destroyed'})),enemyTanks:r.enemyTanks.map(e=>({...e,state:'destroyed'}))});});await page.keyboard.down('KeyW');await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>__tron.state.music.category==='exploration'&&!testMusic.paused&&!testMusic.ended);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>__tron.state.music.error),null);
 console.log('Exploration cue plays once, does not replay on re-entry, and resets for a new game.');
}finally{await browser.close();}
