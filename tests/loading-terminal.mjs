import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/*.glb*',async route=>{await gate;await route.continue();});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'commit'});
  await page.locator('#loading').waitFor({state:'visible'});
  assert.match(await page.locator('#loading').innerText(),/LOADING\.\.\./);
  assert(await page.locator('#intro').isHidden());
  const states=await page.locator('.loading-dots').evaluate(dots=>{
    const spans=[...dots.children];
    const animations=spans.map(s=>s.getAnimations()[0]);
    return [0,500,950,1400].map(time=>{
      animations.forEach(a=>{a.pause();a.currentTime=time;});
      return spans.map(s=>Number(getComputedStyle(s).opacity));
    });
  });
  assert.deepEqual(states,[[0,0,0],[1,0,0],[1,1,0],[1,1,1]]);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.deepEqual(await page.locator('.loading-dots span').evaluateAll(spans=>spans.map(s=>getComputedStyle(s).opacity)),['1','1','1']);

  await page.keyboard.press('Enter');
  assert(await page.locator('#loading').isVisible());
  release();
  await page.locator('#intro').waitFor({state:'visible',timeout:120000});
  assert(await page.locator('#loading').isHidden());
  assert(await page.locator('#start').isEnabled());
  assert.match(await page.locator('#terminal-text').innerText(),/REQUEST ACCESS TO CLU/);
  assert.deepEqual(errors,[]);
  console.log('Loading terminal remains visible during delayed model loading; opening replaces it when setup completes.');
} finally {await browser.close();}
