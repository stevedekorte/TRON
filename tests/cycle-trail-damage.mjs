import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/trail-damage-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://localhost:5173/trail-damage-preview');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{LightCycleWalls}=await import('/src/rendering/light-cycle-walls.js'),{damageCycleTrail,expireDamagedTrails}=await import('/src/simulation/cycle-trail-damage.js');
  const scene=new T.Scene();scene.background=new T.Color(0x030710);const walls=new LightCycleWalls(scene);
  const r={time:0,phase:'racing',cycles:[{id:0,alive:true,escaped:true,segment:0}],trails:[{bikeId:0,team:1,x1:-4,z1:0,x2:4,z2:0}],crashes:[],occupied:new Uint8Array(173*173),outerOccupied:{}};
  damageCycleTrail(r,0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,700);document.body.append(renderer.domElement);const camera=new T.PerspectiveCamera(48,1200/700,.1,100);camera.position.set(0,7,29);camera.lookAt(0,.6,0);
  window.renderDamage=time=>{r.time=time;expireDamagedTrails(r);walls.update(r,1);renderer.render(scene,camera);return r.trails.length;};
 });
 for(const [time,count] of [[0,2],[3.59,2],[4,1]]){assert.equal(await page.evaluate(time=>renderDamage(time),time),count);await page.screenshot({path:`test-results/cycle-trail-damage-${time}.png`});}
 assert.deepEqual(errors,[]);console.log('Impact gap, older wall lowering, and surviving newer wall rendered without errors.');
}finally{await browser.close();}
