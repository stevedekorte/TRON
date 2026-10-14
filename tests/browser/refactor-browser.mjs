import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});
 page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Offline test',code:'unavailable'})}));
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 await page.goto((process.env.TRON_URL||'http://127.0.0.1:5173')+'/?maze=blueprint&layoutSeed=1982&runSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 await page.keyboard.press('KeyW');await page.keyboard.up('KeyW');
 assert.equal(await page.evaluate(()=>__tron.state.scenario.layout),'blueprint');
 assert.equal(await page.evaluate(()=>__tron.state.scenario.layoutSeed),1982);
 const original=await page.evaluate(()=>{const s=__tron.state;const x=s.recognizers[0].x;s.recognizers[0].x=999999;return {x,current:__tron.state.recognizers[0].x};});
 assert.equal(original.x,original.current,'debug snapshots cannot mutate the run');
 await page.keyboard.press('Escape');const time=await page.evaluate(()=>__tron.state.time);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__tron.state.time),time);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/refactor-follow.png'});
 await page.keyboard.press('Escape');await page.keyboard.press('KeyV');await page.waitForTimeout(100);await page.screenshot({path:'test-results/refactor-aerial.png'});
 await page.keyboard.press('KeyP');await page.waitForTimeout(100);await page.screenshot({path:'test-results/refactor-gunner.png'});
 const resources=[];
 for(let i=0;i<3;i++){await page.evaluate(()=>__tron.reset());await page.waitForTimeout(100);resources.push(await page.evaluate(()=>({geometries:__tron.state.renderer.geometries,textures:__tron.state.renderer.textures,contexts:__tron.state.audioContexts})));}
 assert.equal(resources[0].geometries,resources[2].geometries);assert.equal(resources[0].textures,resources[2].textures);assert.equal(resources[2].contexts,1);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:await browser.version(),scenario:'blueprint:1982',resources,checks:'snapshot isolation, pause, views, repeated reset'}));
}finally{await browser.close();}
