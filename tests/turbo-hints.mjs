import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='running');
 await page.waitForFunction(()=>!document.querySelector('#hint').classList.contains('faded'));
 const rows=await page.locator('#hint span').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>n.getBoundingClientRect().top));
 assert.ok(rows.every(y=>Math.abs(y-rows[0])<1));assert.ok(rows[0]<40);
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#hint')).opacity)>.95);
 await page.screenshot({path:'test-results/idle-controls.png'});
 await page.keyboard.press('KeyT');await page.waitForFunction(()=>window.__tron.state.turboRemaining>0);
 let state=await page.evaluate(()=>window.__tron.state);assert.ok(state.speed>50);assert.ok(state.turboRemaining<=10);
 assert.equal(await page.locator('#tuning').isVisible(),false);
 assert.equal(await page.locator('#turbo-status').textContent(),'');
 assert.equal(await page.locator('#hint').evaluate(e=>e.classList.contains('faded')),false);
 await page.keyboard.press('Escape');const remaining=await page.evaluate(()=>window.__tron.state.turboRemaining);
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__tron.state.turboRemaining),remaining);
 await page.keyboard.press('Enter');await page.evaluate(()=>window.__tron.place({turboRemaining:.05}));
 await page.waitForFunction(()=>window.__tron.state.turboRemaining===0);await page.waitForTimeout(1800);
 assert.ok(await page.evaluate(()=>window.__tron.state.speed)<=22);
 assert.equal(await page.locator('#turbo-status').textContent(),'');
 await page.keyboard.press('KeyT');assert.equal(await page.evaluate(()=>window.__tron.state.turboRemaining),0);
 await page.evaluate(()=>window.__tron.place({turboCooldown:.02}));await page.waitForFunction(()=>document.querySelector('#turbo-status').textContent==='✓');
 console.log('T boosts, pauses and expires; startup controls remain centered in one row after the first input.');
}finally{await browser.close();}
