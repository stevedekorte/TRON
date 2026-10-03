import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/audio-fixture',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 await page.goto('http://127.0.0.1:5173/audio-fixture');
 const results=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');const results=[];
  for(const x of [-20,20,200]){
   const c=new OfflineAudioContext(2,48000,48000),sound=new Sound();sound.context=c;sound.master=c.createGain();sound.master.connect(c.destination);
   sound.effect('hit',{subject:'surface',x,y:0,s:0});
   const buffer=await c.startRendering(),power=[0,1].map(ch=>buffer.getChannelData(ch).reduce((sum,v)=>sum+v*v,0));results.push({x,power});
  }return results;
 });
 assert(results[0].power[0]>results[0].power[1]*2);
 assert(results[1].power[1]>results[1].power[0]*2);
 assert(results[1].power[1]>results[2].power[1]*20);
 console.log('Wall hits pan left/right and attenuate with distance:',results);
}finally{await browser.close();}
