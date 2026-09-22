import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {teleportSamples} from '../src/audio/teleport.js';
await mkdir('test-results',{recursive:true});
const channels=teleportSamples(48000,'player'),frames=channels[0].length,wav=Buffer.alloc(44+frames*4);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(192000,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++)for(let c=0;c<2;c++){assert(Number.isFinite(channels[c][i])&&Math.abs(channels[c][i])<1);wav.writeInt16LE(Math.round(channels[c][i]*32767),44+i*4+c*2);}
await writeFile('test-results/teleport-preview.wav',wav);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/teleport-audio-fixture',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 await page.goto('http://127.0.0.1:5173/teleport-audio-fixture');
 const results=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');const output=[];
  for(const [phase,player,muted,reset] of [['departure',false,false,false],['arrival',false,false,false],['arrival',true,false,false],['arrival',true,true,false],['arrival',true,false,true]]){
   const s=new Sound(),c=s.context=new OfflineAudioContext(2,48000,48000);s.master=c.createGain();s.master.gain.value=muted?0:1;s.master.connect(c.destination);
   if(player){s.effect('teleport',{phase:'departure',player:true,x:0,y:0,s:0});if(s.sources.size)throw Error('Duplicate player cue');}
   s.effect('teleport',{phase,player,x:0,y:0,s:0});if(reset)s.reset();const audio=await c.startRendering();let energy=0,peak=0;
   for(const v of audio.getChannelData(0)){if(!Number.isFinite(v))throw Error('Invalid sample');energy+=v*v;peak=Math.max(peak,Math.abs(v));}
   output.push({phase,player,muted,reset,rms:Math.sqrt(energy/audio.length),peak,remainingSources:s.sources.size});
  }return output;
 });
 for(const r of results){assert.equal(r.remainingSources,0);if(r.muted||r.reset)assert.equal(r.peak,0);else assert(r.rms>.005&&r.peak<1);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
}finally{await browser.close();}
