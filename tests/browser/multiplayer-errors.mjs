import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Original=window.WebSocket;window.mpAttempts=0;
  window.WebSocket=class extends Original{
   constructor(url,...args){
    if(!String(url).includes('/api/multiplayer')){super(url,...args);return;}
    window.mpAttempts++;
    const socket={readyState:0,close(){this.readyState=3;},send(){}};
    setTimeout(()=>socket.onerror?.(new Event('error')),20);return socket;
   }
  };
 });
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-multiplayer').disabled,null,{timeout:120000});
 await page.locator('#start-multiplayer').click();
 await page.locator('#error').waitFor({state:'visible',timeout:60000});
 const state=await page.evaluate(()=>{
  const panel=document.querySelector('#error'),content=panel.querySelector('.error-content'),title=panel.querySelector('h2');
  return {attempts:mpAttempts,terminal:document.body.classList.contains('terminal'),font:getComputedStyle(title).fontFamily,fontSize:parseFloat(getComputedStyle(title).fontSize),game:getComputedStyle(document.querySelector('#game')).visibility,overflow:content.scrollWidth>content.clientWidth,focus:document.activeElement.id};
 });
 assert.equal(state.attempts,3);assert(state.terminal);assert(state.font.includes('FilmTerminal'));assert(state.fontSize<30);assert.equal(state.game,'hidden');assert(!state.overflow);assert.equal(state.focus,'error-home');
 await page.screenshot({path:'test-results/multiplayer-error-terminal.png'});
 await page.setViewportSize({width:640,height:600});
 assert(await page.locator('#error .error-content').evaluate(el=>el.scrollWidth<=el.clientWidth));
 await page.locator('#error-home').click();await page.locator('#intro').waitFor({state:'visible'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({state,returnedHome:true,errors}));
}finally{await browser.close();}
