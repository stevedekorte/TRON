import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{if(chunk.toString().includes('Local:'))resolve();});server.on('exit',code=>reject(new Error('Server exited '+code)));});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.addInitScript(()=>{
  window.fadeLog=[];window.transitionFrames=[];
  const record=()=>{
   const background=document.querySelector('#home-transition-background');
   if(background&&window.__tron)window.transitionFrames.push({opacity:Number(getComputedStyle(background).opacity),text:Math.max(...[...document.querySelectorAll('[data-home-other]')].map(e=>Number(getComputedStyle(e).opacity))),mode:__tron.state.mode,y:__tron.state.camera.y,vehicle:__tron.state.playerVehicle});
   requestAnimationFrame(record);
  };requestAnimationFrame(record);
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   if(options?.duration===825||this.id==='home-transition-background'||this.id==='home-selected-label')window.fadeLog.push({id:this.id,classes:this.className,start:performance.now(),duration:options.duration,delay:options.delay||0});
   return animate.call(this,frames,options);
  };
 });
 await page.route('**/transition-isolated',r=>r.fulfill({contentType:'text/html',body:'<div id="intro"><p class="terminal-copy">SELECT PROGRAM</p><div id="game-menu"><button id="choice">CLU</button><button>LIGHT CYCLES</button></div></div>'}));
 await page.goto('http://127.0.0.1:5180/transition-isolated');
 const immediate=await page.evaluate(async()=>{
  const {createHomeTransition}=await import('/src/ui/home-transition.js');
  const transition=createHomeTransition();
  await transition.begin(document.querySelector('#choice'),{waitForScene:true});
  await new Promise(resolve=>setTimeout(resolve,120));
  const other=document.querySelector('[data-home-other]');
  const result={text:Number(getComputedStyle(other).opacity),background:Number(getComputedStyle(document.querySelector('#home-transition-background')).opacity),state:other.getAnimations()[0].playState};
  transition.clear();return result;
 });
 const mcpCover=await page.evaluate(async()=>{
  const {createHomeTransition}=await import('/src/ui/home-transition.js');const transition=createHomeTransition();
  await transition.begin(document.querySelector('#choice'),{keepCovered:true});
  const opacity=getComputedStyle(document.querySelector('#home-transition-background')).opacity;transition.clear();return opacity;
 });
 assert.equal(mcpCover,'1','MCP navigation never reveals the CLU preview');
 assert(immediate.text<.95&&immediate.text>0,'unselected text fades before scene readiness');
 assert.equal(immediate.state,'running');assert(Math.abs(immediate.background-immediate.text)<.04,'background and text share fade progress');
 const covered=await page.evaluate(async()=>{
  const {createHomeTransition}=await import('/src/ui/home-transition.js');
  const transition=createHomeTransition();
  await transition.begin(document.querySelector('#choice'),{waitForScene:true,coverUntilSceneReady:true});
  await new Promise(resolve=>setTimeout(resolve,150));
  const background=document.querySelector('#home-transition-background');
  const result={opacity:Number(getComputedStyle(background).opacity),text:Number(getComputedStyle(document.querySelector('[data-home-other]')).opacity)};
  transition.sceneReady();
  await new Promise(resolve=>setTimeout(resolve,150));
  result.revealed=Number(getComputedStyle(background).opacity);
  result.fadedText=Number(getComputedStyle(document.querySelector('[data-home-other]')).opacity);
  transition.clear();return result;
 });
 assert.equal(covered.opacity,1,'cover hides the previous game until the new scene renders');
 assert.equal(covered.text,1,'text waits for the same reveal as the new scene');
 assert(covered.revealed<1&&covered.revealed>0,'new scene fades in after readiness');
 assert(Math.abs(covered.revealed-covered.fadedText)<.02,'text and game dissolve together');
 for(const [id,vehicle] of [['start','tank'],['start-cycles','cycle'],['start-credits',null],['start-bit','bit']]){
  await page.goto('http://127.0.0.1:5180/');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
  await page.locator('#'+id).focus();
  await page.keyboard.press('Enter');
  if(vehicle==='bit'){
   await page.waitForURL('**/bit/index.html');
   await page.waitForFunction(()=>fadeLog.some(e=>e.id==='home-selected-label'),{},{timeout:20000});
   await page.locator('#home-transition').waitFor({state:'detached'});
  }else{
   await page.waitForFunction(()=>fadeLog.some(e=>e.id==='home-transition-background'));
   const log=await page.evaluate(()=>fadeLog),fade=log.find(e=>e.id==='home-transition-background'),others=log.filter(e=>e.duration===825&&e.id!=='home-transition-background');
   const blink=log.find(e=>e.id==='home-selected-label');
   assert.equal(blink.duration,1100);assert.equal(blink.delay,825);
   const frames=await page.locator('#home-transition').evaluate(e=>JSON.parse(e.dataset.blinkFrames));
   assert.equal(frames.filter(f=>f.opacity===0&&f.offset<1).length,3,'three quick label-only blinks');
   assert(frames.filter(f=>f.opacity===0&&f.offset<1).every(f=>f.offset>.4&&f.offset<.85));
   const blinkOpacities=await page.locator('#home-selected-label').evaluate(label=>{
    const animation=label.getAnimations()[0],time=animation.currentTime,state=animation.playState,timing=animation.effect.getTiming();
    animation.pause();
    const result=[.49,.56,.63,.70,.77,.84].map(f=>{animation.currentTime=timing.delay+f*timing.duration;return Number(getComputedStyle(label).opacity);});
    animation.currentTime=time;if(state==='running')animation.play();return result;
   });
   assert.deepEqual(blinkOpacities,[0,1,0,1,0,1]);
   assert.equal(fade.delay,0);assert.equal(fade.duration,825);
   assert(fade.start<=others[0].start,'background fade starts with the unselected text');
   assert.equal(others.length,7);assert(others.some(e=>e.id==='home-selection-cursor'),'cursor fades in the first phase');assert(!others.some(e=>e.id===id));
   if(vehicle==='tank')assert.equal(await page.locator('#game').evaluate(e=>getComputedStyle(e).visibility),'visible');
   await page.locator('#home-transition').waitFor({state:'detached'});
   if(vehicle){
    if(vehicle==='tank'){
     const moving=await page.evaluate(()=>transitionFrames.filter(f=>f.mode==='entering'&&f.opacity>.1&&f.opacity<.9));
     assert(moving.length>=2,'CLU opening renders during the background dissolve');
     assert(Math.abs(moving[0].y-moving.at(-1).y)>.01,'opening camera moves while the game fades in');
    }
    if(vehicle==='cycle'){
     const revealed=await page.evaluate(()=>transitionFrames.filter(f=>f.opacity<.99));
     assert(revealed.length>0,'cycle transition reveals the arena');
     assert(revealed.every(f=>f.vehicle==='cycle'),'never reveal CLU during light-cycle selection');
     const dissolving=revealed.filter(f=>f.opacity>.1&&f.opacity<.9);
     assert(dissolving.length>=2,'arena reveal spans multiple frames');
     assert(dissolving.every(f=>Math.abs(f.opacity-f.text)<.04),'arena and unselected text fade in sync');
    }
    await page.waitForFunction(()=>__tron.state.mode==='running');
    assert.equal(await page.evaluate(()=>__tron.state.playerVehicle==='cycle'),vehicle==='cycle');
   }else assert(await page.locator('body').evaluate(e=>e.classList.contains('victory-credits')));
  }
  console.log(id,'transition passed');
 }
 assert.deepEqual(errors,[]);console.log('Home two-stage fade: CLU, cycles, credits and BIT passed.');
}finally{await browser.close();server.kill();}
