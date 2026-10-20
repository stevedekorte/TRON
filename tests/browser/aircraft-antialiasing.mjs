import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TRON_URL||'http://127.0.0.1:5188/';
 await page.route('**/aa-aircraft-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:black"></body>'}));
 await page.goto(new URL('aa-aircraft-check',base).href);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {EffectComposer}=await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
  const {RenderPass}=await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
  const {UnrealBloomPass}=await import('/node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js');
  const {SMAAPass}=await import('/node_modules/three/examples/jsm/postprocessing/SMAAPass.js');
  const {OutputPass}=await import('/node_modules/three/examples/jsm/postprocessing/OutputPass.js');
  const {loadRecognizer,createRecognizer}=await import('/src/rendering/models.js');
  const {loadSolarSailer}=await import('/src/rendering/solar-sailer.js');
  const {GAME_LIGHTING,createGameLights}=await import('/src/rendering/game-lighting.js');
  const {AdaptiveAA,supportedSamples}=await import('/src/rendering/adaptive-aa.js');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  renderer.toneMapping=GAME_LIGHTING.toneMapping;renderer.toneMappingExposure=GAME_LIGHTING.exposure;
  const quality=new AdaptiveAA(supportedSamples(renderer.getContext())).quality;
  const scene=new T.Scene();scene.background=new T.Color(0x03050c);scene.add(createGameLights());
  const camera=new T.PerspectiveCamera(45,1000/700,.1,10000);
  const composer=new EffectComposer(renderer,new T.WebGLRenderTarget(1000,700,{type:T.HalfFloatType,samples:quality.samples,stencilBuffer:true}));
  composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(1000,700),.35,.5,.85));composer.addPass(new SMAAPass());composer.addPass(new OutputPass());
  const models={recognizer:createRecognizer(await loadRecognizer()).root,sailer:(await loadSolarSailer()).ship};
  for(const model of Object.values(models))scene.add(model);
  window.captureAircraft=(name,ratio)=>{
   for(const [key,model] of Object.entries(models))model.visible=key===name;
   const model=models[name];model.updateMatrixWorld(true);const box=new T.Box3();
   model.traverseVisible(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}});
   const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),distance=size.length()*1.15;
   camera.position.copy(center).add(new T.Vector3(.45,.25,1).normalize().multiplyScalar(distance));camera.lookAt(center);
   renderer.setPixelRatio(ratio);renderer.setSize(1000,700);composer.setPixelRatio(ratio);composer.setSize(1000,700);composer.render();
   return {quality,ratio,pixels:renderer.domElement.width*renderer.domElement.height};
  };
 });
 for(const name of ['recognizer','sailer'])for(const ratio of [1,1.5]){
  const result=await page.evaluate(([name,ratio])=>captureAircraft(name,ratio),[name,ratio]);
  assert.equal(result.quality.ratio,1.5);assert.equal(result.pixels,700000*ratio*ratio);
  await page.screenshot({path:`test-results/aa-${name}-${ratio}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Recognizer and Solar Sailer comparisons rendered at 1x and restored 1.5x with the game lighting and MSAA/bloom/SMAA/output pipeline.');
}finally{await browser.close();}
