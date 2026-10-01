import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
  window.SpeechRecognition=class {start(){} abort(){} stop(){this.onend?.();}};
 });
 for(const game of ['start','start-cycles','start-bit']){
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(id=>!document.getElementById(id).disabled,game);
  await page.locator('#'+game).click();
  const bit=game==='start-bit';
  if(bit)await page.waitForFunction(()=>window.VizApp?._objects?.length===1);
  else await page.waitForFunction(()=>__tron.state.mode==='running'&&!__tron.state.arenaWaiting,null,{timeout:60000});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('#exit-confirm').open);
  assert.equal(await page.locator(':focus').getAttribute('data-cancel'),'');
  if(bit){
   assert(await page.evaluate(()=>bitPaused&&VizApp._objects[0]._listeningPaused));
  }else{
   const time=await page.evaluate(()=>__tron.state.time);
   await page.keyboard.press('KeyW');await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>__tron.state.time),time);
   assert.equal(await page.evaluate(()=>__tron.state.mode),'paused');
  }
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#exit-confirm [data-confirm]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#exit-confirm [data-cancel] .menu-marker').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await page.locator('#exit-confirm [data-confirm] .menu-marker').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.locator('#exit-confirm [data-confirm] .menu-marker').evaluate(e=>getComputedStyle(e).animationDuration),'0.85s');
  await page.keyboard.press('ArrowUp');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:`test-results/exit-confirm-${game}.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#exit-confirm').evaluate(e=>e.open),false);
  if(bit)assert(await page.evaluate(()=>!bitPaused&&!VizApp._objects[0]._listeningPaused));
  else await page.waitForFunction(()=>__tron.state.mode==='running');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#exit-confirm [data-cancel]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#exit-confirm [data-confirm]').getAttribute('aria-pressed'),'true');
  if(bit)await page.locator('#exit-confirm [data-confirm]').click();
  else await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#start')&&!document.querySelector('#start').disabled&&window.__tron?.state.mode==='ready');
 }
 assert.deepEqual(errors,[]);
 console.log('Clu, cycles and BIT: Escape confirmation, pause, cancellation/resume and home navigation passed.');
}finally{await browser.close();}
