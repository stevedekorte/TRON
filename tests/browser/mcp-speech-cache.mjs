import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const rate=24000,frames=2400,wav=Buffer.alloc(44+frames*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
for(let i=0;i<frames;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*8000),44+i*2);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();let requests=0;
 await context.route('**/api/mcp/voice-status',r=>r.fulfill({json:{configured:true}}));
 await context.route('**/api/mcp/speech',r=>{requests++;return r.fulfill({json:{audioUrl:'http://127.0.0.1:5173/test-voice.wav'}});});
 await context.route('**/test-voice.wav',r=>r.fulfill({contentType:'assets/audio/wav',body:wav}));
 await context.route('**/speech-cache-fixture',r=>r.fulfill({contentType:'text/html',body:'<body>Speech cache check</body>'}));
 let page=await context.newPage();await page.goto('http://127.0.0.1:5173/speech-cache-fixture');
 const first=await page.evaluate(async()=>{
  const {McpVoice}=await import('/src/mcp/voice.js');window.voice=new McpVoice();await voice.load();
  const [a,b]=await Promise.all([voice.generate('ENTER QUERY'),voice.generate('ENTER  QUERY')]);
  if(a!==b)throw Error('Concurrent generation not deduplicated');
  const tail=a.samples.slice(Math.ceil(2400/.92));
  return {processed:a.processed,frames:a.samples.length,tailEnergy:tail.reduce((sum,x)=>sum+x*x,0),samples:Array.from(a.samples)};
 });
 assert.equal(requests,1);assert.equal(first.processed,true);assert(first.frames>2400/.92);assert(first.tailEnergy>0,'processed cache includes the reverb tail');
 await page.close();page=await context.newPage();await page.goto('http://127.0.0.1:5173/speech-cache-fixture');
 const restored=await page.evaluate(async()=>{
  const {McpVoice}=await import('/src/mcp/voice.js');const voice=new McpVoice();await voice.load();const a=await voice.generate('ENTER QUERY');voice.cancel();return {processed:a.processed,samples:Array.from(a.samples)};
 });
 assert.equal(requests,1,'reload must reuse IndexedDB without a TTS request');assert.equal(restored.processed,true);assert.deepEqual(restored.samples,first.samples);
 await page.evaluate(async()=>{
  const {McpSpeechCache}=await import('/src/mcp/speech-cache.js');const old=new McpSpeechCache('obsolete-voice');await old.put('OLD REPLY',{samples:new Float32Array([.1]),sampleRate:24000,processed:true});await old.close();
  const current=new McpSpeechCache();if(await current.get('OLD REPLY'))throw Error('Old voice survived invalidation');await current.close();
  const {McpVoice}=await import('/src/mcp/voice.js');const voice=new McpVoice();await voice.load();await voice.generate('ENTER QUERY');voice.cancel();
 });
 assert.equal(requests,2,'new voice version generates fresh audio');
 console.log('Processed PCM persists across reload, concurrent requests deduplicate, pitch/reverb are baked, and old voice versions clear.');
}finally{await browser.close();}
