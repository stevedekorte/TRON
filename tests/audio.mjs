import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/audio.html');
 const measurements=await page.evaluate(async()=>{
  const {stereoEmitter,doppler}=await import('/src/audio/spatial.js');
  const bytes=await (await fetch('/audio/recognizer-flight.wav')).arrayBuffer();
  async function render(x,muffled=false){
   const c=new OfflineAudioContext(2,44100,44100),buffer=await c.decodeAudioData(bytes.slice(0));
   const emitter=stereoEmitter(c,c.destination);emitter.gain.gain.value=muffled?.4:1;emitter.position(x,0,-15,0);
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=muffled?550:6500;filter.connect(emitter.input);
   const s=c.createBufferSource();s.buffer=buffer;s.connect(filter);s.start();
   const output=await c.startRendering();
   return [0,1].map(ch=>{const a=output.getChannelData(ch);let energy=0;for(let i=3000;i<a.length;i++)energy+=a[i]*a[i];return Math.sqrt(energy/(a.length-3000));});
  }
  const run={x:0,s:0,yaw:0,speed:0},e={x:30,s:0,y:30,vx:-20,vs:0,vy:0};
  return {left:await render(-30),right:await render(30),far:await render(300),wall:await render(30,true),approaching:doppler(e,run),receding:doppler({...e,vx:20},run)};
 });
 assert.ok(measurements.left[0]>measurements.left[1]*1.1,JSON.stringify(measurements));
 assert.ok(measurements.right[1]>measurements.right[0]*1.1,JSON.stringify(measurements));
 assert.ok(measurements.far[1]<measurements.right[1]*.3);
 assert.ok(measurements.wall[1]<measurements.right[1]);
 assert.ok(measurements.approaching>1&&measurements.receding<1);
 await page.getByRole('button',{name:'Start flyby'}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('left'));
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='entering');
 await page.waitForFunction(()=>window.__tron.state.audioState==='running'&&window.__tron.state.audioOutput>.0001);
 assert.equal(await page.evaluate(()=>window.__tron.state.shots),0);
 assert.ok(await page.evaluate(()=>window.__tron.state.music.time)>0);
 await page.waitForFunction(()=>document.body.classList.contains('playing'));
 await page.waitForFunction(()=>window.__tron.state.audioSamples.length===4);
 let state=await page.evaluate(()=>window.__tron.state);
 assert.ok(state.music.time>0);assert.equal(state.music.paused,false);assert.equal(state.music.error,null);
 await page.keyboard.press('Escape');
 const musicTime=await page.evaluate(()=>window.__tron.state.music.time);
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__tron.state.music.time),musicTime);
 await page.keyboard.press('Enter');await page.waitForTimeout(250);
 assert.ok(await page.evaluate(()=>window.__tron.state.music.time)>musicTime);
 await page.evaluate(()=>__tron.reset());await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>window.__tron.state.music.time)<1);assert.deepEqual(state.audioSampleErrors,[]);assert.equal(state.audioNodes,11);
 for(let i=0;i<3;i++){await page.keyboard.press('Space');await page.evaluate(()=>__tron.reset());await page.waitForTimeout(120);}
 await page.waitForTimeout(1000);state=await page.evaluate(()=>window.__tron.state);assert.equal(state.audioNodes,11);assert.equal(state.audioContexts,1);
 await page.keyboard.press('KeyM');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__tron.state.mode),'paused');
 await page.goto('http://127.0.0.1:5173/audio.html');
 // A missing individual sample must preserve the remaining samples and fallback.
 await page.route('**/audio/cannon.wav*',r=>r.fulfill({status:404,body:'missing'}));
 const fallback=await page.evaluate(async()=>{const {Sound}=await import('/src/audio/sound.js');const s=new Sound();s.init();await s.loading;const result={samples:Object.keys(s.samples).length,errors:s.sampleErrors.length};s.dispose();return result;});
 assert.deepEqual(fallback,{samples:3,errors:1});assert.deepEqual(errors,[]);
 console.log({measurements,checks:'stereo left/right, distance, wall filtering, Doppler, four decoded samples, stable reset nodes, missing-file fallback'});
}finally{await browser.close();}
