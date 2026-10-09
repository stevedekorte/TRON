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
  window.fadeLog=[];
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   if(options?.duration===825||this.id==='home-transition'||this.id==='home-selected-label')window.fadeLog.push({id:this.id,classes:this.className,start:performance.now(),duration:options.duration,delay:options.delay||0});
   return animate.call(this,frames,options);
  };
 });
 for(const [id,vehicle] of [['start','tank'],['start-cycles','cycle'],['start-credits',null],['start-bit','bit']]){
  await page.goto('http://127.0.0.1:5180/');
  await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
  await page.locator('#'+id).focus();
  await page.keyboard.press('Enter');
  if(vehicle==='bit'){
   await page.waitForURL('**/bit/index.html');
   await page.waitForFunction(()=>fadeLog.some(e=>e.id==='home-transition'),{},{timeout:20000});
   await page.locator('#home-transition').waitFor({state:'detached'});
  }else{
   await page.waitForFunction(()=>fadeLog.some(e=>e.id==='home-transition'));
   const log=await page.evaluate(()=>fadeLog),fade=log.find(e=>e.id==='home-transition'),others=log.filter(e=>e.duration===825);
   assert(!log.some(e=>e.id==='home-selected-label'),'label inherits the background fade instead of fading separately');
   assert.equal(fade.delay,825);assert.equal(fade.duration,1100);
   assert(fade.start<=others[0].start,'shared fade is scheduled before game setup');
   assert.equal(others.length,6);assert(others.some(e=>e.id==='home-selection-cursor'),'cursor fades in the first phase');assert(!others.some(e=>e.id===id));
   if(vehicle){
    await page.waitForFunction(()=>{
     const curtain=document.querySelector('#home-transition');
     if(!curtain)return false;
     const opacity=Number(getComputedStyle(curtain).opacity);
     return opacity>.2&&opacity<.8&&getComputedStyle(document.querySelector('#game')).visibility==='visible'&&['entering','running'].includes(__tron.state.mode);
    });
    if(vehicle==='tank')await page.screenshot({path:'test-results/clu-terminal-crossfade.png'});
   }
   await page.locator('#home-transition').waitFor({state:'detached'});
   if(vehicle){
    await page.waitForFunction(()=>__tron.state.mode==='running');
    assert.equal(await page.evaluate(()=>__tron.state.playerVehicle==='cycle'),vehicle==='cycle');
   }else assert(await page.locator('body').evaluate(e=>e.classList.contains('victory-credits')));
  }
  console.log(id,'transition passed');
 }
 assert.deepEqual(errors,[]);console.log('Home two-stage fade: CLU, cycles, credits and BIT passed.');
}finally{await browser.close();server.kill();}
