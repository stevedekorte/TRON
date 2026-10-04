import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1250,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.playerVehicle==='cycle'&&__tron.state.cycleRace.phase==='racing',null,{timeout:60000});
 await page.waitForTimeout(5000);
 const height=await page.evaluate(async()=>{
  const {loadLightCycles}=await import('/src/rendering/light-cycles.js'),{Box3}=await import('/node_modules/three/build/three.module.js');
  const [gold]=await loadLightCycles(),bounds=new Box3().setFromObject(gold);
  return bounds.max.y-bounds.min.y;
 });
 await page.evaluate(()=>{
  const race=__tron.state.cycleRace,b=race.cycles[race.playerId];
  race.arenaPaused=true;Object.assign(b,{x:408/4.8,previousX:408/4.8,z:0,previousZ:0,progress:1,yaw:Math.PI/2,dir:3});
  __tron.place({cycleRace:race});
 });
 await page.waitForTimeout(200);
 for(const key of [null,'KeyJ','KeyL']){
  if(key){await page.keyboard.down(key);await page.waitForTimeout(250);}
  const state=await page.evaluate(()=>{const s=__tron.state,b=s.cycleRendering.bikes[s.cycleRace.playerId];return {camera:s.camera,bike:b.position,screen:__tron.project({x:b.position[0],y:1,s:-b.position[2]})};});
  assert(state.camera.y>height+.3,'camera stays above the actual cycle model');
  if(!key)await page.screenshot({path:'test-results/arena-camera-close-wall.png'});
  if(key)await page.keyboard.up(key);
 }
 await page.keyboard.down('KeyK');await page.waitForTimeout(1600);await page.keyboard.up('KeyK');
 const followPitch=await page.evaluate(async()=>{
  const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js');
  const c=__tron.state.camera,d=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(c.rotation));
  return {down:Math.asin(-d.y),fov:c.fov};
 });
 assert(followPitch.down<followPitch.fov*Math.PI/360,'I/K follow view includes the horizon without glancing');
 await page.screenshot({path:'test-results/cycle-zoom-follow-horizon.png'});
 await page.keyboard.down('KeyJ');await page.waitForTimeout(1000);
 const pitch=await page.evaluate(async()=>{
  const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js');
  const c=__tron.state.camera,d=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(c.rotation));
  return {down:Math.asin(-d.y),fov:c.fov,y:c.y};
 });
 assert(pitch.y>20,'K raises the cycle camera');
 assert(pitch.down<pitch.fov*Math.PI/360,'zoomed glance includes the horizon');
 await page.screenshot({path:'test-results/cycle-zoom-glance-horizon.png'});
 await page.keyboard.up('KeyJ');
 assert.deepEqual(errors,[]);console.log('Arena camera: model/wall clearance and zoomed glance horizon passed.');
}finally{await browser.close();}
