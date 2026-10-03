import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce',hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
  window.SpeechRecognition=class {start(){} abort(){window.speechAborted=true;} stop(){this.onend?.();}};
 });
 let answer='m0',requests=0;
 await page.route('**/api/jev/decision',async route=>{
  const body=route.request().postDataJSON();
  if(body.controller!=='bit'){await route.fulfill({status:503,body:'{}'});return;}
  requests++;assert.equal(route.request().headers().authorization,undefined);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:answer,confidence:1})});
 });
 const home=async()=>{
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>!document.querySelector('#start-bit').disabled);
 };
 await home();
 await page.locator('#start-bit').click();await page.waitForURL('**/bit/index.html');
 assert.equal(await page.title(),'ENCOM TERMINAL');
 // Selection itself starts Bit; no extra activation gesture.
 await page.waitForFunction(()=>window.VizApp?._objects?.length===1);
 assert.equal(await page.locator('#api-key-settings').count(),0);
 assert.equal(await page.locator('.exit-hint').isVisible(),true);
 for(const [id,text] of [['m0','YES'],['m1','NO'],['m2','???']]){
  answer=id;await page.evaluate(()=>VizApp._objects[0].searchRequest('Are you Bit?'));
  assert.equal(await page.locator('#answer').textContent(),text);
  await page.waitForTimeout(1600);
  assert.equal(await page.locator('#answer').evaluate(e=>getComputedStyle(e).opacity),'1');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#answer')).opacity==='0');
 }
 assert.equal(requests,3);
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/bit-program.png'});
 assert.equal(await page.locator('.exit-hint').textContent(),'ESCAPE KEY TO EXIT');
 assert.equal(await page.locator('.exit-hint').evaluate(e=>getComputedStyle(e).fontSize),await page.locator('#instructions').evaluate(e=>getComputedStyle(e).fontSize));
 await page.evaluate(()=>{
  const bit=VizApp._objects[0];bit._listeningPaused=false;bit._ignoreSpeechUntil=0;
  bit._recognition.onresult({results:[[{transcript:'Are you Bit'}]]});
 });
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#instructions')).opacity==='0'&&getComputedStyle(document.querySelector('.exit-hint')).opacity==='0');
 await page.keyboard.press('Escape');await page.locator('#exit-confirm [data-confirm]').click();await page.waitForURL('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-bit').disabled);
 assert.equal(await page.evaluate(()=>typeof window.VizApp),'undefined');
 for(const method of ['click','tap']){
  await page.locator('#start-bit')[method]();await page.waitForURL('**/bit/index.html');
  await page.keyboard.press('Escape');await page.locator('#exit-confirm [data-confirm]').click();await page.waitForURL('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>!document.querySelector('#start-bit').disabled);
 }
 assert.deepEqual(errors,[]);
 for (const state of ['granted','prompt','denied','unsupported']) {
  const permissionPage=await browser.newPage();
  permissionPage.on('pageerror',e=>errors.push(e.message));
  await permissionPage.addInitScript(state=>{
   navigator.permissions.query=async()=>{if(state==='unsupported')throw new Error('unsupported');return {state};};
   navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{
    window.allowMic=()=>resolve({getTracks:()=>[{stop(){window.trackStopped=true;}}]});
    window.denyMic=()=>reject(new Error('denied'));
   });
   window.SpeechRecognition=class {start(){} abort(){} stop(){this.onend?.();}};
  },state);
  await permissionPage.goto('http://127.0.0.1:5173/bit/index.html');
  await permissionPage.waitForFunction(()=>document.body.classList.contains('bit-ready'));
  if(state==='granted'){
   assert.equal(await permissionPage.locator('body').evaluate(e=>e.classList.contains('awaiting-microphone')),false);
   await permissionPage.waitForFunction(()=>VizApp._objects.length===1);
   assert.equal(await permissionPage.locator('#instructions').textContent(),'Ask a yes or no question');
  }else{
   assert.equal(await permissionPage.locator('#instructions').evaluate(e=>getComputedStyle(e,'::after').animationName),'bit-cursor');
   assert.equal(await permissionPage.evaluate(()=>!!VizApp._didBegin),false);
   await permissionPage.waitForFunction(()=>typeof window.allowMic==='function');
   assert.equal(await permissionPage.locator('#instructions').textContent(),'REQUESTING MICROPHONE ACCESS');
   assert.equal(await permissionPage.evaluate(()=>!!VizApp._didBegin),false);
   if(state==='denied'){
    await permissionPage.evaluate(()=>window.denyMic());
    await permissionPage.waitForFunction(()=>document.querySelector('#instructions').textContent.includes('ALLOW MICROPHONE'));
    assert.equal(await permissionPage.evaluate(()=>!!VizApp._didBegin),false);
   }else{
    await permissionPage.evaluate(()=>window.allowMic());
    await permissionPage.waitForFunction(()=>VizApp._objects.length===1);
    assert.equal(await permissionPage.evaluate(()=>window.trackStopped),true);
    assert.equal(await permissionPage.locator('body').evaluate(e=>e.classList.contains('awaiting-microphone')),false);
   }
  }
  for(const width of [1280,390]){
   await permissionPage.setViewportSize({width,height:800});
   await permissionPage.waitForFunction(()=>{
    const heading=document.getElementById('instructions'),range=document.createRange();
    range.selectNodeContents(heading);const rect=range.getBoundingClientRect();
    return Math.abs((rect.left+rect.right)/2-innerWidth/2)<1;
   });
   const aligned=await permissionPage.evaluate(()=>Math.abs(document.querySelector('#instructions').getBoundingClientRect().left-document.querySelector('#input').getBoundingClientRect().left)<1);
   assert(aligned);
  }
  await permissionPage.close();
 }
 assert.deepEqual(errors,[]);
 console.log('BIT: menu/answers/Escape plus granted, prompt, denied and unsupported microphone-permission paths passed.');
}finally{await browser.close();}
