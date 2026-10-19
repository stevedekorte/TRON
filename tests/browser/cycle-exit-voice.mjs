import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TRON_URL??'http://127.0.0.1:5188/')+'assets/audio/cycle-illegal-exit-source.json');
 const result=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');const {CycleExitVoice}=await import('/src/audio/cycle-exit-voice.js');
  const context=new AudioContext();await context.resume();const owner={context,samples:{},sampleErrors:[]};await Sound.prototype.loadCycleSamples.call(owner);
  const audio=new CycleExitVoice(context,context.destination,owner.samples),race={round:1,playerId:0,cycles:[{id:0}],phase:'racing'};
  audio.update(race,null,true,true);race.cycles[0].escapeRevision=1;audio.update(race,null,true,true);
  const voice=audio.voice;await new Promise(r=>setTimeout(r,200));const active=!!voice&&audio.voice===voice;
  audio.reset();await context.close();return {active,duration:owner.samples['cycle-illegal-exit']?.duration,errors:owner.sampleErrors};
 });
 assert(result.active);assert(result.duration>9&&result.duration<12);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
