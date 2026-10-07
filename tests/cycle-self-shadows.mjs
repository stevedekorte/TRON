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
    const returns=[];model.traverse(m=>{if(m.name==='Sealed rear body return')returns.push(m);});
    if(returns.length!==2)throw Error('Both rear body returns must be sealed');
    for(const patch of returns){
     const surface=new T.Mesh(patch.geometry,patch.material),sign=Math.sign(patch.geometry.attributes.position.getX(0));surface.updateMatrixWorld(true);
     for(let x=.087;x<.112;x+=.001)for(const y of [.23,.3,.4]){
      const hits=new T.Raycaster(new T.Vector3(sign*x,y,1),new T.Vector3(0,0,-1)).intersectObject(surface);
      if(!hits.length)throw Error('Gap in rear body return');
     }
    }
    let count=0;model.traverse(m=>{if(m.name==='Refined rear wheel ring')count++;});
    if(count!==1)throw Error('Expected exactly one refined rear ring per team model');
    let spokes=0;model.traverse(m=>{if(m.name==='Smooth rear wheel spoke')spokes++;});
    if(spokes!==0)throw Error('Fake rear wheel highlight must be removed');
    let rims=0;model.traverse(m=>{if(m.isMesh&&m.material.userData.cycleRim){rims++;if(m.material.color.getHex()!==0x080b10||m.material.roughness!==.08||m.material.clearcoat!==1)throw Error('Rim material lost its dark reflective finish');}});
    if(rims<3)throw Error('Both wheels need black inner rim materials');
    const outer=model.getObjectByName('Refined rear wheel ring');
    if(outer.material.userData.cycleRim||outer.material.color.getHex()===0x080b10)throw Error('Outer wheel must retain its team paint');
    if(model.getObjectByName('Reflective front wheel rim'))throw Error('Front team paint must not be extracted into a black rim');
    let interiors=0;model.traverse(m=>{if(m.userData.refinedWheelInterior)interiors++;});
    if(interiors!==3)throw Error('Expected smooth inner discs on both wheels');
    const a=new T.Box3().setFromObject(model),b=new T.Box3().setFromObject(originals[i]);
    if(a.min.distanceTo(b.min)>.01||a.max.distanceTo(b.max)>.01)throw Error('Wheel refinement changed bike proportions');
   });
  }
  window.overlapRepairs=models.map(m=>m.userData.cycleOverlapRepairs);
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
 for(const [name,position] of [['front',[3,1.5,-4]],['left',[-4,1.6,1]],['rear',[1,1.3,4]]]){
  await page.evaluate(position=>{const {renderer,scene,camera}=window.shadowPreview;camera.position.set(...position);camera.lookAt(0,.65,0);renderer.render(scene,camera);},position);
  await page.screenshot({path:`test-results/cycle-surface-${name}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('Trimmed overlapping triangles per model:',await page.evaluate(()=>window.overlapRepairs));
 console.log('Actual cycle model and self-shadow shader rendered without WebGL errors.');
}finally{await browser.close();}
