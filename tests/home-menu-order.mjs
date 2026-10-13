import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('#game-menu button').evaluateAll(bs=>bs.map(b=>b.dataset.game)),['cycles','space','bit','mcp','credits']);
 const selected=()=>page.locator('#game-menu [aria-pressed="true"]').getAttribute('data-game');
 assert.equal(await selected(),'cycles');
 await page.keyboard.press('ArrowUp');assert.equal(await selected(),'credits');
 await page.keyboard.press('ArrowDown');assert.equal(await selected(),'cycles');
 await page.keyboard.press('ArrowDown');assert.equal(await selected(),'space');
 await page.keyboard.press('ArrowUp');assert.equal(await selected(),'cycles');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle',null,{timeout:60000});
 await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing'&&__tron.state.cycleRace.cycles.filter(b=>b.alive).every(b=>(__tron.state.cycleRendering.bikes[b.id].wheelReflection?.phase??0)>0),null,{timeout:60000});
 const first=await page.evaluate(()=>__tron.state.cycleRendering.bikes.map(b=>b.wheelReflection?.phase??0));
 await page.waitForFunction(first=>__tron.state.cycleRace.cycles.filter(b=>b.alive).every(b=>(__tron.state.cycleRendering.bikes[b.id].wheelReflection?.phase??0)>first[b.id]+.1),first,{timeout:15000});
 console.log('Live wheel phases:',await page.evaluate(()=>__tron.state.cycleRace.cycles.filter(b=>b.alive).map(b=>({id:b.id,player:b.id===__tron.state.cycleRace.playerId,...__tron.state.cycleRendering.bikes[b.id].wheelReflection}))));
 assert.deepEqual(errors,[]);console.log('Menu order, initial selection, wraparound navigation and Return launch passed.');
}finally{await browser.close();}
