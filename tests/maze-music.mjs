import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForTimeout(1000);
 await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio/sound.js'),{PerspectiveCamera}=await import('/node_modules/three/build/three.module.js'),{createRun}=await import('/src/simulation/run.js');
  const sound=new Sound(),r=createRun(1982),beam={...r.dataBeams[0]},camera=new PerspectiveCamera(60,1,.1,2000);
  r.x=beam.x+30;r.s=beam.s;r.recognizers=[];r.enemyTanks=[];r.dataBeams=[];
  camera.position.set(beam.x+30,6,-beam.s);camera.lookAt(beam.x+60,6,-beam.s);camera.updateMatrixWorld();
  window.h={sound,r,beam,camera};document.body.innerHTML='<button id="unlock">Start test</button>';
  document.querySelector('#unlock').onclick=async()=>{await sound.unlock();sound.startMusic();window.timer=setInterval(()=>sound.musicDirector.updateMusic(r,camera,true),30);};
 });await page.click('#unlock');
 const category=c=>page.waitForFunction(c=>h.sound.musicDirector.musicCategory===c&&!h.sound.musicDirector.music.paused&&Number.isFinite(h.sound.musicDirector.music.duration),c);
 await category('exploration');
 await page.evaluate(()=>h.r.dataBeams=[h.beam]);await category('approaching');
 await page.evaluate(()=>{h.camera.lookAt(h.beam.x,.25,-h.beam.s);h.camera.updateMatrixWorld();});await category('spotted');
 await page.evaluate(()=>h.r.x=h.beam.x);await category('enter');
 await page.evaluate(()=>h.sound.effect('dataRingOpen',h.beam));await category('afterglow');
 assert.ok(decodeURIComponent(await page.evaluate(()=>h.sound.musicDirector.music.src)).includes('5 afterglow.mp3'));
 await page.evaluate(()=>{h.beam.collectedAt=0;});await page.waitForTimeout(2100);assert.equal(await page.evaluate(()=>h.sound.musicDirector.musicCategory),'afterglow');
 await page.evaluate(()=>h.r.enemyTanks=[{state:'pursue'}]);await category('pursued');
 await page.evaluate(()=>h.r.enemyTanks=[]);await page.waitForFunction(()=>h.sound.musicDirector.music.paused);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>h.sound.musicDirector.musicError),null);
 await page.evaluate(()=>{clearInterval(timer);h.sound.dispose();});console.log('Exploration → hidden approach → visible base → entry; ring opening plays afterglow and collection preserves it; pursuit interrupts; quiet fades.');
}finally{await browser.close();}
