import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://localhost:5173/?layoutSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.locator('#start').click();
 try{await page.waitForFunction(()=>__tron.state.mode==='running',null,{timeout:60000});}
 catch(error){console.error({errors,state:await page.evaluate(()=>({mode:__tron.state.mode,error:document.querySelector('#error-message')?.textContent}))});throw error;}
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async()=>{
  const {browserScenario}=await import('/src/game/browser-scenario.js');
  const world=window.cameraWallWorld=browserScenario(location).world;
  const p=world.OPEN_CELLS.find(p=>world.freePosition(p.x,p.s,4)
   &&world.wallIntersection({...p,y:3.5},{x:p.x+19,s:p.s,y:8},1.2)!==null
   &&world.wallIntersection({...p,y:3.5},{x:p.x-90,s:p.s,y:3.5},4)===null);
  if(!p)throw Error('No near-wall camera fixture found');
  __tron.place({x:p.x,s:p.s,yaw:Math.PI/2,turretYaw:0,speed:0,cruiseThrottle:false,recognizers:[],enemyTanks:[],impact:0});
 });
 await page.waitForTimeout(300);
 await page.evaluate(()=>{
  window.cameraWallSamples=[];window.cameraWallSampling=true;let previous;
  function sample(){const c=__tron.state.camera,p={x:c.x,y:c.y,s:-c.z},world=window.cameraWallWorld;
   cameraWallSamples.push({inside:world.wallIntersection(p,p,.2)!==null,crossed:!!previous&&world.wallIntersection(previous,p,.2)!==null});previous=p;
   if(window.cameraWallSampling)requestAnimationFrame(sample);
  }sample();
 });
 await page.keyboard.down('KeyK');await page.waitForTimeout(1800);await page.keyboard.up('KeyK');
 const tankBeforeDrive=await page.evaluate(()=>({x:__tron.state.x,s:__tron.state.s}));
 await page.keyboard.down('KeyW');
 await page.keyboard.down('KeyI');await page.waitForTimeout(2100);await page.keyboard.up('KeyI');
 await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 const follow=await page.evaluate(()=>({x:__tron.state.x,s:__tron.state.s,camera:__tron.state.camera}));
 assert(Math.hypot(follow.x-tankBeforeDrive.x,follow.s-tankBeforeDrive.s)>30,'drive away from the wall while zoom returns');
 assert(Math.hypot(follow.camera.x-follow.x,follow.camera.z+follow.s)<35,'camera must keep following the moving tank');
 await page.keyboard.down('KeyL');await page.waitForTimeout(700);await page.keyboard.up('KeyL');
 await page.keyboard.press('KeyP');await page.waitForTimeout(900);await page.keyboard.press('KeyP');await page.waitForTimeout(1000);
 const samples=await page.evaluate(()=>{window.cameraWallSampling=false;return window.cameraWallSamples;});
 assert(samples.length>30);assert(samples.every(s=>!s.inside&&!s.crossed),'rendered camera must stay outside walls, including between frames');
 await page.screenshot({path:'test-results/clu-camera-wall-clearance.png'});
 assert.deepEqual(errors,[]);console.log(`Clu wall clearance: ${samples.length} rendered frames through zoom, turret rotation and gunner transitions passed.`);
}finally{await browser.close();}
