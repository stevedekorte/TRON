import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.waitForFunction(()=>document.querySelector('.terminal-copy.complete'));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron.state.mode==='running');
 const a=await page.evaluate(()=>window.__tron.state);
 assert.ok(a.audioSamples.includes('carrier-rumble'));assert.deepEqual(a.audioSampleErrors,[]);
 await page.waitForTimeout(1000);const b=await page.evaluate(()=>window.__tron.state);
 assert.ok(b.carrier[0]>a.carrier[0]);assert.equal(b.carrier[1],a.carrier[1]);assert.equal(b.carrier[2],a.carrier[2]);
 assert.ok(Math.abs((b.carrier[0]-a.carrier[0])-24*(b.time-a.time))<.001);
 await page.keyboard.press('Escape');await page.waitForTimeout(100);
 const frozen=await page.evaluate(()=>window.__tron.state.carrier);
 await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.__tron.state.carrier),frozen);
 await page.screenshot({path:'test-results/carrier-game.png'});
 // Check every anatomical section in both open and folded poses. A surface hit
 // must retain exactly two intact sections and conserve all source triangles.
 const sections=await page.evaluate(async()=>{
 await (await import('/src/simulation/debris-physics.js')).debrisPhysicsReady;
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadRecognizer,createRecognizer}=await import('/src/rendering/models.js');
  const {Breakups}=await import('/src/rendering/breakup.js');
  const craft=createRecognizer(await loadRecognizer());craft.root.scale.setScalar(.5);
  const scene=new T.Scene(),breakups=new Breakups(scene),results=[];
  for(const fold of [0,1])for(const part of ['body','left-leg','right-leg']){
   craft.root.position.set(0,80,0);craft.root.rotation.y=.7;craft.pose(fold);craft.root.updateMatrixWorld(true);
   let sourceCount=0,hit;
   craft.root.traverse(m=>{if(!m.isMesh)return;sourceCount+=m.geometry.index?.count??m.geometry.attributes.position.count;
    const label=m.parent.name==='left-leg'||m.parent.name==='right-leg'?m.parent.name:'body';
    if(label===part&&!hit){const p=m.geometry.attributes.position,i=m.geometry.index?.getX(0)??0;hit=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);}
   });
   breakups.spawn(craft,{x:0,y:80,s:0,yaw:.7,fold,hit});
   const burst=breakups.bursts[0];let outputCount=0;
   for(const p of burst.pieces)p.group.traverse(m=>{if(m.isMesh)outputCount+=m.geometry.attributes.position.count;});
   results.push({part,hitPart:burst.hitPart,sourceCount,outputCount,whole:burst.pieces.filter(p=>!p.fragmented).map(p=>p.part)});
   breakups.clear();
  }
  return results;
 });
 for(const r of sections){assert.ok(r.part==='body'?['crown','crossbar','left-shoulder','right-shoulder'].includes(r.hitPart):r.hitPart===r.part);assert.equal(r.sourceCount,r.outputCount);assert.equal(r.whole.length,5);assert.ok(!r.whole.includes(r.part));}
 const lights=await page.evaluate(async()=>{
 await (await import('/src/simulation/debris-physics.js')).debrisPhysicsReady;
  const {loadCarrier,updateCarrier}=await import('/src/rendering/carrier.js');const ship=await loadCarrier();
  updateCarrier(ship,.1);const bright=ship.userData.beacons.map(b=>b.material.emissiveIntensity);
  updateCarrier(ship,.6);const dim=ship.userData.beacons.map(b=>b.material.emissiveIntensity);
  return {bright,dim};
 });
 assert.ok(lights.bright.length>0);assert.notDeepEqual(lights.bright,lights.dim);
 assert.deepEqual(errors,[]);console.log('Carrier straight transit and pause verified; posed section hits preserve all five unhit sections and every source triangle.');
}finally{await browser.close();}
