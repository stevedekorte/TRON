import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1250,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>!document.querySelector('#start-cycles').disabled);
 await page.locator('#start-cycles').click();
 await page.waitForFunction(()=>__tron.state.cycleRace?.phase==='racing',null,{timeout:60000});
 const result=await page.evaluate(async()=>{
  const {trimCycleTrails}=await import('/src/simulation/cycle-trails.js');
  const {CYCLE_TRAIL_LIMIT}=await import('/src/game/cycle-trails.js');
  const {LightCycleWalls}=await import('/src/rendering/light-cycle-walls.js');
  const THREE=await import('/node_modules/three/build/three.module.js');
  const r=__tron.state.cycleRace;r.arenaPaused=true;r.occupied.fill(0);r.crashes=[];
  const id=r.playerId,b=r.cycles[id];
  for(const bike of r.cycles)bike.segment=-1;
  const points=[[-80,-80],[80,-80],[80,80],[-80,80],[-80,-70],[70,-70],[70,50]];
  r.trails=points.slice(1).map((p,i)=>({bikeId:id,team:0,x1:points[i][0],z1:points[i][1],x2:p[0],z2:p[1]}));
  Object.assign(b,{x:70,previousX:70,z:50,previousZ:49,dir:2,progress:1,segment:5});
  trimCycleTrails(r);
  const root=new THREE.Group(),walls=new LightCycleWalls(root);walls.update(r,1);
  let length=0;for(const mesh of walls.meshes)for(let i=0;i<mesh.count;i++)length+=mesh.geometry.attributes.trailDistance.getX(i);
  for(const mesh of walls.meshes){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}
  __tron.place({cycleRace:r});
  return {length,limit:CYCLE_TRAIL_LIMIT.lengthMeters};
 });
 assert(Math.abs(result.length-result.limit)<.001,JSON.stringify(result));
 await page.keyboard.press('v');await page.waitForTimeout(1500);
 await page.screenshot({path:'test-results/cycle-trail-limit.png'});
 assert.deepEqual(errors,[]);console.log('Rendered trail length matches inner perimeter; Chrome has no page errors.',result);
}finally{await browser.close();}
