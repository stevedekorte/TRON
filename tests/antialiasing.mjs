import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 const size=()=>page.evaluate(()=>({width:document.querySelector('#game').width,height:document.querySelector('#game').height,...__tron.state.renderer}));
 const first=await size();assert.equal(first.width,1920);assert.equal(first.height,1200);assert.equal(first.pixelRatio,1.5);assert.equal(first.smaa,true);assert.equal(first.samples,4);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({speed:0,recognizers:[],enemyTanks:[]}));await page.waitForTimeout(1000);
 await page.screenshot({path:'test-results/antialiasing.png'});
 await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(200);assert.equal((await size()).width,1536);
 await page.evaluate(()=>__tron.configure({renderScale:.5}));await page.waitForTimeout(200);assert.equal((await size()).width,768);
 assert.deepEqual(errors,[]);console.log('4x MSAA + SMAA and 1.5x Retina supersampling render without errors; resizing and renderScale remain consistent.');
}finally{await browser.close();}
