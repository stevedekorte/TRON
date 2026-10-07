import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!document.querySelector('#start').disabled,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js'),{GameSession}=await import('/src/simulation/game-session.js');
  window.audioOrder=[];
  const tone=Sound.prototype.terminalTone,reset=GameSession.prototype.reset;
  Sound.prototype.terminalTone=function(type){if(type==='access')audioOrder.push({event:'beep',time:performance.now()});return tone.call(this,type);};
  GameSession.prototype.reset=function(...args){audioOrder.push({event:'reset',time:performance.now()});return reset.apply(this,args);};
 });
 await page.locator('#start').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>audioOrder.some(e=>e.event==='reset'));
 const order=await page.evaluate(()=>audioOrder);assert.equal(order[0].event,'beep');assert.equal(order.filter(e=>e.event==='beep').length,1);assert.equal(order[1].event,'reset');
 console.log('Return queues one access beep before game reset:',order);
}finally{await browser.close();}
