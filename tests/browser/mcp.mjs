import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 for(const denied of [false,true]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({denied})=>{
   window.liveAudioContexts=0;const NativeAudioContext=window.AudioContext;window.AudioContext=class extends NativeAudioContext{constructor(...args){super(...args);window.liveAudioContexts++;}};
   window.musicPauses=0;const pause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){if(this.src.startsWith('blob:')||this.src.includes('20%20Break')||this.src.includes('20 Break'))window.musicPauses++;return pause.call(this);};
   window.events=[];window.audioStarts=[];window.audioRates=[];window.generationScreens=[];window.permissionDenied=denied;
   const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts.push(document.querySelector('#reply').textContent);window.audioRates.push(this.playbackRate.value);return start.apply(this,args);};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.startsWith('blob:')||this.src.includes('20%20Break')||this.src.includes('20 Break')){window.musicStartedAt=document.querySelector('#reply').textContent;window.musicCalledAt=performance.now();}return play.call(this);};
   navigator.mediaDevices.getUserMedia=async()=>{window.permissionAt=performance.now();events.push(['permission',document.querySelector('#reply').textContent]);if(window.permissionDenied)throw Error('denied');return {getTracks:()=>[{stop(){}}]};};
   new MutationObserver(()=>{if(!window.completedAt&&document.querySelector('#reply')?.textContent==='REQUEST: ACCESS TO MASTER CONTROL PROGRAM.')window.completedAt=performance.now();if(!window.firstTypedAt&&document.querySelector('#reply')?.textContent.startsWith('R'))window.firstTypedAt=performance.now();}).observe(document,{subtree:true,childList:true,characterData:true});
   window.SpeechRecognition=class{constructor(){window.recognition=this;}start(){events.push(['listen']);}abort(){this.onend?.();}};
  },{denied});
  await page.route('**/src/mcp/voice.js',r=>r.fulfill({contentType:'application/javascript',body:`export class McpVoice {ready=false;generating=false;async load(){this.ready=true;}async generate(text){window.generationScreens.push(document.querySelector('#reply').textContent);window.events.push(['speech',text]);await new Promise(r=>setTimeout(r,100));return {samples:new Float32Array(2400),sampleRate:24000,processed:true};}abort(){}cancel(){}}`}));
  await page.route('**/api/mcp/status',r=>r.fulfill({json:{configured:true}}));
  await page.route('**/api/mcp/chat',r=>{return r.fulfill({json:{reply:'END OF LINE.'}});});
  await page.route('**/cache-check',r=>r.fulfill({contentType:'text/html',body:'cache check'}));
  await page.goto('http://127.0.0.1:5173/cache-check');
  await page.evaluate(async()=>{
   for(const name of ['tron-mcp-voice-models','unrelated-cache'])await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
   const cache=await caches.open('cleanup-test');await cache.put('/chatterbox-ONNX/model.onnx',new Response('old'));await cache.put('/keep-game-asset',new Response('keep'));
   const {clearLegacyMcpCache}=await import('/src/mcp/clear-legacy-cache.js');await clearLegacyMcpCache();
  });
  assert.deepEqual(await page.evaluate(async()=>({old:(await indexedDB.databases()).some(d=>d.name==='tron-mcp-voice-models'),unrelated:(await indexedDB.databases()).some(d=>d.name==='unrelated-cache'),oldFile:!!await caches.match('/chatterbox-ONNX/model.onnx'),game:!!await caches.match('/keep-game-asset')})),{old:false,unrelated:true,oldFile:false,game:true});
  await page.goto('http://127.0.0.1:5173/mcp.html');
  await page.waitForFunction(()=>events.some(e=>e[0]==='permission'),null,{timeout:30000});
  const events=await page.evaluate(()=>window.events);
  assert.equal(events[0][1],'REQUEST: ACCESS TO MASTER CONTROL PROGRAM.');
  assert(await page.evaluate(()=>permissionAt-completedAt>=1450),'completed introduction holds for 1.5 seconds');
  if(denied){
   await page.waitForFunction(()=>document.querySelector('#reply').textContent.startsWith('MASTER CONTROL PROGRAM UNAVAILABLE\nAUDIO INPUT'));
   assert.equal(events.length,1);
   assert.match(await page.locator('#reply').textContent(),/ALLOW MICROPHONE ACCESS/);
   await page.evaluate(()=>{window.permissionDenied=false;});await page.keyboard.press('Enter');
   await page.waitForFunction(()=>events.some(e=>e[0]==='listen'),null,{timeout:15000});
  }else{
   await page.waitForFunction(()=>events.some(e=>e[0]==='listen'),null,{timeout:15000});
   const order=await page.evaluate(()=>events);
   assert.deepEqual(order.slice(0,3).map(e=>e[0]),['permission','speech','listen']);
   assert.equal(order[1][1],'IDENTIFY USER AND ACCESS CODE.');
   await page.evaluate(()=>recognition.onresult({resultIndex:0,results:[[{transcript:'Hello'}]]}));
   await page.waitForFunction(()=>audioStarts.includes('END OF LINE.'));
   assert.deepEqual(await page.evaluate(()=>generationScreens),['',''],'responses stay hidden while speech generates');
  }
  assert((await page.evaluate(()=>audioStarts)).includes('IDENTIFY USER AND ACCESS CODE.'),'greeting text is present at audio start');
  assert.equal(await page.evaluate(()=>window.musicStartedAt),'CONNECTING TO CORE...','connecting message remains until typing starts');
  assert(await page.evaluate(()=>firstTypedAt-musicCalledAt>=950),'music is cued at least a second before typing');
  assert((await page.evaluate(()=>audioRates)).every(rate=>rate===1),'processed cached audio plays at 1x without another pitch pass');
  assert.equal(await page.evaluate(()=>liveAudioContexts),1,'music and speech share one live output engine');
  assert.equal(await page.evaluate(()=>musicPauses),0,'speech startup never pauses the background music');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('MCP permission after typing, denial screen, cloned greeting before listening, and spoken reply passed.');
}finally{await browser.close();}
