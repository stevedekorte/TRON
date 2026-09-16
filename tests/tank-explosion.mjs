import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {tankExplosionSamples,TANK_EXPLOSION} from '../src/audio/tank-explosion.js';
for(const rate of [44100,48000])for(let variant=0;variant<TANK_EXPLOSION.variants;variant++){
 const samples=tankExplosionSamples(rate,variant);
 let peak=0;for(const channel of samples){for(const v of channel){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));}assert.ok(channel[0]===0);assert.ok(Math.abs(channel.at(-1))<1e-5);}
 assert.ok(peak<=.841);assert.notDeepEqual(samples[0],samples[1]);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto(process.env.TRON_URL||'http://127.0.0.1:5174');
 const results=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');
  const results=[];
  for(const subject of ['tank','enemyTank'])for(const distance of [15,180]){
   const c=new OfflineAudioContext(2,96000,48000),sound=new Sound();sound.context=c;sound.master=c.createGain();sound.master.connect(c.destination);
   sound.effect('destroyed',{subject,x:distance,y:0,s:0});
   const source=[...sound.sources][0];const duration=source.buffer.duration;
   const buffer=await c.startRendering();let power=0;
   for(let i=0;i<buffer.length;i++)for(let ch=0;ch<2;ch++)power+=buffer.getChannelData(ch)[i]**2;
   results.push({subject,distance,duration,rms:Math.sqrt(power/(buffer.length*2)),sources:sound.sources.size});
  }
  return results;
 });
 for(const result of results){assert.equal(result.duration,1.65);assert.ok(result.rms>0);assert.equal(result.sources,0);}
 for(const subject of ['tank','enemyTank']){const pair=results.filter(r=>r.subject===subject);assert.ok(pair[0].rms>pair[1].rms*2);}
 console.log('Tank explosion variants are finite and bounded at 44.1/48kHz; both destruction events render, attenuate with distance and release sources.',results);
}finally{await browser.close();}
