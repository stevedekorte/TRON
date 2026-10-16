import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TRON_URL??'http://127.0.0.1:5188/';
 await page.goto(base+'assets/audio/cycle-blue-leader-source.json');
 const result=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js');
  const {MultiplayerTeamVoice}=await import('/src/audio/multiplayer-team-voice.js');
  const context=new AudioContext();await context.resume();
  const owner={context,samples:{},sampleErrors:[]};await Sound.prototype.loadCycleSamples.call(owner);
  const master=context.createGain();master.connect(context.destination);
  const audio=new MultiplayerTeamVoice(context,master,owner.samples);
  const rows=[];
  for(const [team,color] of ['gold','blue','red','green'].entries()){
   const race={round:team+1,phase:'countdown',cycles:[{id:3,team}]},mp={connected:true,seat:3};
   audio.update(race,mp,true);race.phase='racing';audio.update(race,mp,true);
   const voice=audio.voice;
   await new Promise(resolve=>setTimeout(resolve,1200));
   rows.push({color,duration:owner.samples[`cycle-${color}-leader`]?.duration,scheduled:!!voice,correctBuffer:voice?.source.buffer===owner.samples[`cycle-${color}-leader`],activeAfterDelay:audio.voice===voice});
   audio.reset();
  }
  master.disconnect();await context.close();
  return {rows,ready:owner.cycleSamplesReady,errors:owner.sampleErrors};
 });
 assert(result.ready);for(const row of result.rows){assert(row.duration>3&&row.duration<6);assert(row.scheduled&&row.correctBuffer&&row.activeAfterDelay);}
 assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
