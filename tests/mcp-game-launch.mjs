import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
  window.SpeechRecognition=class{start(){window.testRecognition=this;}abort(){}stop(){}};
  const original=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){window.lastSpeechStart=performance.now();this.addEventListener('ended',()=>window.lastSpeechEnd=performance.now());return original.apply(this,args);};
  window.addEventListener('message',event=>{if(event.data?.type==='mcp-launch')window.launchReceived=performance.now();});
 });
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'{}'}));
 await page.route('**/api/mcp/status',r=>r.fulfill({json:{configured:true}}));
 await page.route('**/api/mcp/chat',r=>r.fulfill({json:{reply:'UNAUTHORIZED USER.\nREPORT TO THE GAME GRID.',action:{type:'launch_game',game:'cycles'}}}));
 await page.route('**/src/mcp/terminal-intro.js',r=>r.fulfill({contentType:'text/javascript',body:`export function typeMcpAccess(e,done){setTimeout(done,50);const cancel=()=>{};cancel.pauseMusic=()=>{};cancel.resumeMusic=()=>{};cancel.fadeOutMusic=()=>{window.musicFadeAt=performance.now();};return cancel;}`}));
 await page.route('**/src/mcp/voice.js',r=>r.fulfill({contentType:'text/javascript',body:`export class McpVoice {ready=false;generating=false;async load(){this.ready=true;}async generate(){return {samples:new Float32Array(4800),sampleRate:24000,processed:true};}abort(){}cancel(){}}`}));
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-mcp').disabled);
 await page.locator('#start-mcp').click();
 const frame=await (await page.waitForSelector('#mcp-panel')).contentFrame();
 await frame.waitForFunction(()=>window.testRecognition);
 await frame.evaluate(()=>testRecognition.onresult({resultIndex:0,results:[[{transcript:'I am an unauthorized user.'}]]}));
 await frame.waitForFunction(()=>document.body.classList.contains('mcp-command'));
 assert(await frame.locator('#face').isVisible());
 assert.equal(await page.locator('#mcp-panel').evaluate(e=>e.hidden),false);
 await page.waitForFunction(()=>window.launchReceived,null,{timeout:15000});
 assert(await frame.evaluate(()=>performance.now()-lastSpeechEnd>=990),'transfer waits a second after speech');
 assert.equal(await page.locator('#home-selected-label').count(),0,'no home menu label in direct transition');
 await page.waitForFunction(()=>document.querySelector('#mcp-panel').hidden&&__tron.state.playerVehicle==='cycle',null,{timeout:60000});
 assert(await frame.evaluate(()=>window.musicFadeAt>lastSpeechEnd),'music fades during game transition');
 assert.equal(await page.evaluate(()=>__tron.state.mode),'running');
 assert.deepEqual(errors,[]);console.log('MCP face at speech, full announcement, one-second hold, music fade, and direct cycle entry passed.');
}finally{await browser.close();}
