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
    let interiors=0;model.traverse(m=>{if(m.userData.refinedWheelInterior)interiors++;});
    if(interiors!==3)throw Error('Expected smooth inner discs on both wheels');
    const a=new T.Box3().setFromObject(model),b=new T.Box3().setFromObject(originals[i]);
    if(a.min.distanceTo(b.min)>.01||a.max.distanceTo(b.max)>.01)throw Error('Wheel refinement changed bike proportions');
   });
  }
  const view=new LightCycleRaceView(models,scene);
  const race={round:1,time:1,phase:'racing',accumulator:0,trails:[],crashes:[],cycles:Array.from({length:4},(_,team)=>({id:team,team,alive:true,x:(team-1.5)*1.1,previousX:(team-1.5)*1.1,z:0,previousZ:0,dir:0}))};
  view.update(race);
  const colors=view.bikes.slice(0,4).map(b=>{let color;b.traverse(o=>{if(o.isMesh&&o.material.name==='Color_D06')color=o.material.color.getHex();});return color;});
  if(new Set(colors).size!==4)throw Error('Each team needs its own body color');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,900);renderer.toneMapping=GAME_LIGHTING.toneMapping;renderer.toneMappingExposure=GAME_LIGHTING.exposure;
  const camera=new T.PerspectiveCamera(40,1200/900,.05,100);camera.position.set(3,8,16);camera.lookAt(0,.6,0);
  scene.updateMatrixWorld(true);view.shadows.update(renderer,[],camera.position);renderer.render(scene,camera);
  document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';
  window.shadowPreview={renderer,scene,camera,view};
 },process.env.ORIGINAL_WHEELS!=='1');
 await page.screenshot({path:'test-results/cycle-team-colors.png'});
 assert.deepEqual(errors,[]);
 console.log('Actual cycle model and self-shadow shader rendered without WebGL errors.');
}finally{await browser.close();}
