import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({hasTouch:true,reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 for(const game of ['start','start-cycles']){
  await page.goto('http://localhost:5173/');await page.waitForFunction(id=>!document.getElementById(id).disabled,game);
  await page.locator('#'+game).click();await page.waitForFunction(()=>__tron.state.mode==='running');
  if(game==='start-cycles')await page.waitForFunction(()=>__tron.state.cycleRace.phase==='racing',null,{timeout:60000});
  await page.locator('#controls-prompt').waitFor({state:'visible'});
  assert.equal(await page.locator('#controls-prompt').textContent(),'C / CONTROLS');
  assert.equal(await page.locator('#hint').isVisible(),false);
  await page.locator('#controls-prompt').waitFor({state:'hidden',timeout:10000});
  if(game==='start'){
   await page.keyboard.down('KeyV');
   await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyV',repeat:true,bubbles:true})));
   assert.equal(await page.evaluate(()=>__tron.state.aerial),true);
   await page.keyboard.up('KeyV');await page.keyboard.press('KeyV');
   assert.equal(await page.evaluate(()=>__tron.state.aerial),false);
  }
  const soundLabel=await page.locator('#sound').textContent();await page.keyboard.press('KeyM');assert.equal(await page.locator('#sound').textContent(),soundLabel);
  for(const dismiss of ['Space','Escape','KeyC','click','tap']){
   await page.keyboard.press('KeyC');await page.locator('#controls-help').waitFor({state:'visible'});
   const panelText=await page.locator('#controls-help').innerText();
   assert(panelText.includes('DRIVING')&&panelText.includes('CAMERA'));
   assert(!panelText.includes('M / SOUND')&&!panelText.includes('ANY KEY'));
   const before=await page.evaluate(()=>({time:__tron.state.time,shots:__tron.state.shots}));
   await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__tron.state.time),before.time);
   if(dismiss==='click')await page.mouse.click(30,30);
   else if(dismiss==='tap')await page.touchscreen.tap(30,30);
   else await page.keyboard.press(dismiss);
   await page.locator('#controls-help').waitFor({state:'hidden'});
   await page.waitForFunction(t=>__tron.state.time>t,before.time);
   assert.equal(await page.evaluate(()=>__tron.state.shots),before.shots);
   assert.equal(await page.locator('#exit-confirm').isVisible(),false);
  }
  await page.keyboard.press('KeyC');await page.screenshot({path:`test-results/controls-help-${game}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Clu/cycle controls: paused simulation; keyboard, Escape, C, click and touch resume without firing or opening exit confirmation.');
}finally{await browser.close();}
