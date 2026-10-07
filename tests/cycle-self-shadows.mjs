import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.route('**/shadow-preview',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('http://localhost:5173/shadow-preview');
 await page.evaluate(async refineWheels=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadLightCycles,LightCycleRaceView}=await import('/src/rendering/light-cycles.js');
  const {createGameLights,GAME_LIGHTING}=await import('/src/rendering/game-lighting.js');
  const scene=new T.Scene();scene.background=new T.Color(0x02050c);scene.add(createGameLights());
  const models=await loadLightCycles({refineWheels});
  if(refineWheels){
   const originals=await loadLightCycles({refineWheels:false});
   models.forEach((model,i)=>{
    let count=0;model.traverse(m=>{if(m.name==='Refined rear wheel ring')count++;});
    if(count!==1)throw Error('Expected exactly one refined rear ring per team model');
    let spokes=0;model.traverse(m=>{if(m.name==='Smooth rear wheel spoke')spokes++;});
    if(spokes!==1)throw Error('Expected exactly one smooth rear spoke');
    let rims=0;model.traverse(m=>{if(m.isMesh&&m.material.userData.cycleRim){rims++;if(m.material.color.getHex()!==0x080b10||m.material.roughness!==.24)throw Error('Rim material lost its dark reflective finish');}});
    if(rims<2)throw Error('Both wheels need independent black rim materials');
    let interiors=0;model.traverse(m=>{if(m.userData.refinedWheelInterior)interiors++;});
    if(interiors!==3)throw Error('Expected smooth inner discs on both wheels');
    const a=new T.Box3().setFromObject(model),b=new T.Box3().setFromObject(originals[i]);
    if(a.min.distanceTo(b.min)>.01||a.max.distanceTo(b.max)>.01)throw Error('Wheel refinement changed bike proportions');
   });
  }
  const view=new LightCycleRaceView(models,scene);
  view.materializations.forEach(rez=>rez.update(null));
  view.bikes.forEach((bike,i)=>{bike.visible=i===0;bike.position.y= bike.userData.groundOffsetMeters;});
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,900);renderer.toneMapping=GAME_LIGHTING.toneMapping;renderer.toneMappingExposure=GAME_LIGHTING.exposure;
  const camera=new T.PerspectiveCamera(40,1200/900,.05,100);camera.position.set(3,2.8,4);camera.lookAt(0,.65,0);
  scene.updateMatrixWorld(true);view.shadows.update(renderer);renderer.render(scene,camera);
  document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
  window.shadowPreview={renderer,scene,camera,view};
 },process.env.ORIGINAL_WHEELS!=='1');
 await page.screenshot({path:`test-results/cycle-self-shadow-${process.env.SHADOW_CAPTURE||'smooth'}.png`});
 assert.deepEqual(errors,[]);
 console.log('Actual cycle model and self-shadow shader rendered without WebGL errors.');
}finally{await browser.close();}
