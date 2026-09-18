import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {recognizerHitSamples} from '../src/audio/recognizer-hit.js';
for(const kind of ['tank','recognizer'])for(const rate of [44100,48000])for(let variant=0;variant<3;variant++){
 const channels=recognizerHitSamples(rate,kind,variant);let peak=0;
 for(const channel of channels){assert.ok(channel[0]===0);assert.ok(Math.abs(channel.at(-1))<1e-5);for(const v of channel){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));}}
 assert.ok(peak<=.821);assert.notDeepEqual(channels[0],channels[1]);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.route('**/src/main.js*',route=>route.fulfill({contentType:'application/javascript',body:''}));await page.goto('http://127.0.0.1:5174');
 const results=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js'),results=[];
  for(const subject of ['recognizer','tank','enemyTank'])for(const distance of [15,200]){
   const c=new OfflineAudioContext(2,48000,48000),sound=new Sound();sound.context=c;sound.master=c.createGain();sound.master.connect(c.destination);
   sound.effect('hit',{subject,x:distance,y:2,s:0,fatal:false});
   const source=[...sound.sources][0],duration=source.buffer.duration;
   const buffer=await Promise.race([c.startRendering(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline audio render timed out: '+subject)),10000))]);let power=0;
   for(let ch=0;ch<2;ch++)for(const v of buffer.getChannelData(ch))power+=v*v;
   results.push({subject,distance,duration,rms:Math.sqrt(power/(buffer.length*2)),sources:sound.sources.size});
  }
  return results;
 });
 for(const r of results){assert.ok(r.rms>0);assert.equal(r.sources,0);assert.equal(r.duration,r.subject==='recognizer'?.48:.36);}
 for(const subject of ['recognizer','tank','enemyTank']){const pair=results.filter(r=>r.subject===subject);assert.ok(pair[0].rms>pair[1].rms*2);}
 console.log('Armor hits render for all three subjects, attenuate, remain bounded and release sources.');
}finally{await browser.close();}
