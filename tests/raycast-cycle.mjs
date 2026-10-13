import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort'],{stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.on('data',s=>{if(s.toString().includes('Local:'))resolve();});server.once('exit',()=>reject(Error('Vite failed')));});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5186/raycast-cycle.html');await page.waitForFunction(()=>window.raycastStudy?.ready);
 await page.waitForTimeout(1500);assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/raycast-cycle-first.png'});
 const results=[];
 for(const mode of ['analytic','mesh']){
  await page.evaluate(mode=>raycastStudy.setMode(mode),mode);
  for(const height of [720,1080]){
   await page.evaluate(h=>raycastStudy.resize(h),height);await page.waitForTimeout(1000);
   results.push(await page.evaluate(()=>raycastStudy.measure(8000)));
  }
  await page.screenshot({path:`test-results/raycast-cycle-${mode}.png`});
 }
 await page.locator('#analytic').click();await page.locator('#shadows').check();
 results.push(await page.evaluate(()=>raycastStudy.measure(8000)));
 await page.screenshot({path:'test-results/raycast-cycle-shadow.png'});
 await page.locator('#shadows').uncheck();
 await page.evaluate(()=>raycastStudy.resize(720));
 for(const [name,position] of [['side',[5,1.2,0]],['opposite',[-4.8,2.9,-5.3]],['front',[.3,1.5,-5.5]]]){
  await page.evaluate(p=>{raycastStudy.camera.position.set(...p);raycastStudy.controls.update();},position);
  await page.waitForTimeout(250);await page.screenshot({path:`test-results/pov-cycle-${name}.png`});
 }
 await page.locator('#color').selectOption('#086ac4');await page.waitForTimeout(250);
 await page.screenshot({path:'test-results/pov-cycle-blue.png'});
 console.log(JSON.stringify({results,modelBounds:await page.evaluate(()=>raycastStudy.modelBounds),errors},null,2));
 await writeFile('test-results/raycast-cycle-performance.json',JSON.stringify(results,null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();server.kill();}
