import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Keep Vite dependency optimization from reloading this offline-render harness.
 await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
 await page.goto('http://127.0.0.1:5173/audio.html');
 const result=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');
  const c=new OfflineAudioContext(2,88200,44100),sound=new Sound();sound.context=c;sound.master=c.createGain();sound.master.connect(c.destination);
  const metadata={};
  for(const name of ['recognizer-flight','recognizer-explosion']){
   const response=await fetch('/audio/'+name+'.wav?v=2');if(!response.ok)throw Error(response.status);
   const buffer=await c.decodeAudioData(await response.arrayBuffer());sound.samples[name]=buffer;
   metadata[name]={duration:buffer.duration,channels:buffer.numberOfChannels};
  }
  sound.effect('destroyed',{x:-25,y:5,s:20,yaw:0});const started=sound.sources.size;
  const output=await c.startRendering();await new Promise(r=>setTimeout(r,50));
  const rms=[0,1].map(ch=>{const a=output.getChannelData(ch);return Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length);});
  return {metadata,started,remaining:sound.sources.size,rms};
 });
 assert.equal(result.metadata['recognizer-flight'].duration,1.88);
 assert.equal(result.metadata['recognizer-explosion'].duration,.85);
 for(const m of Object.values(result.metadata))assert.equal(m.channels,2);
 assert.equal(result.started,1);assert.equal(result.remaining,0);
 assert.ok(result.rms[0]>.001);assert.ok(result.rms[0]>result.rms[1]*1.1);
 const hit=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');const c=new OfflineAudioContext(2,22050,44100),s=new Sound();s.context=c;s.master=c.createGain();s.master.connect(c.destination);
  s.effect('hit',{subject:'recognizer',fatal:true,x:25,y:5,s:20});const fatalSources=s.sources.size;
  s.effect('hit',{subject:'recognizer',fatal:false,x:25,y:5,s:20});const started=s.sources.size;
  const output=await c.startRendering();await new Promise(r=>setTimeout(r,50));
  const energy=[0,1].map(ch=>output.getChannelData(ch).reduce((sum,v)=>sum+v*v,0));
  return {fatalSources,started,remaining:s.sources.size,energy};
 });
 assert.equal(hit.fatalSources,0);assert.equal(hit.started,1);assert.equal(hit.remaining,0);assert.ok(hit.energy[1]>hit.energy[0]*1.1);
 assert.deepEqual(errors,[]);console.log({result,hit});
}finally{await browser.close();}
