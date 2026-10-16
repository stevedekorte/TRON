import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({...devices['iPhone 13'],reducedMotion:'reduce'});page.setDefaultTimeout(45000);
 const base=process.env.TRON_URL??'http://127.0.0.1:5188/';
 // Exercise real touch capture independently of racing opponents.
 await page.route('**/touch-check',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css?direct">'}));
 await page.goto(base+'touch-check');
 await page.evaluate(async()=>{
  const {CycleTouchControls}=await import('/src/ui/cycle-touch-controls.js');window.turns=[];window.held=[];
  window.touch=new CycleTouchControls({onTurn:d=>turns.push(d),onHeld:(t,b)=>held=[t,b],onMenu(){},onHelp(){},onRestart(){}});
  touch.update({visible:true,driving:true,spectating:false,restart:false});
 });
 const cdp=await page.context().newCDPSession(page),point=async action=>{const r=await page.locator(`[data-action=${action}]`).boundingBox();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};};
 const turbo={...await point('turbo'),id:1},left={...await point('left'),id:2},right=await point('right');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[turbo]});assert.deepEqual(await page.evaluate(()=>held),[true,false]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[turbo,left]});assert.deepEqual(await page.evaluate(()=>turns),[-1]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[left]});assert.deepEqual(await page.evaluate(()=>held),[true,false]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await page.evaluate(()=>held),[false,false]);
 await page.touchscreen.tap(right.x,right.y);assert.deepEqual(await page.evaluate(()=>turns),[-1,1]);
 const brake={...await point('brake'),id:3};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[brake]});assert.deepEqual(await page.evaluate(()=>held),[false,true]);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.deepEqual(await page.evaluate(()=>held),[false,false]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>touch.dispose());
 console.log('Multitouch passed');
 // Verify the actual game can be entered and exited entirely by touch.
 await page.goto(base);await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 console.log('Mobile home ready');
 await page.locator('#start-cycles').tap();await page.locator('#cycle-touch-controls').waitFor({state:'visible'});
 console.log('Touch controls visible');
 await page.locator('[data-action=help]').tap();await page.locator('#controls-help').waitFor({state:'visible'});
 assert((await page.locator('#controls-help-text').textContent()).includes('TOUCH CONTROLS'));
 await page.touchscreen.tap(30,30);await page.locator('#controls-help').waitFor({state:'hidden'});
 await page.locator('[data-action=menu]').tap();await page.locator('#exit-confirm').waitFor({state:'visible'});
 assert((await page.locator('#exit-confirm [data-cancel]').boundingBox()).height>=48);
 await page.locator('#exit-confirm [data-cancel]').tap();await page.locator('#exit-confirm').waitFor({state:'hidden'});
 await page.locator('[data-action=menu]').tap();await page.locator('#exit-confirm [data-confirm]').tap();
 await page.waitForFunction(()=>__tron.state.mode==='ready');assert(await page.locator('#start-cycles').isVisible());
 console.log('Touch turns, simultaneous turbo/turn, cancellation, brake, blur release, solo launch, help, exit cancel and exit confirm passed.');
}finally{await browser.close();}
