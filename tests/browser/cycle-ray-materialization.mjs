import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {cycleMaterializationPhase} from '../../src/game/cycle-materialization.js';
assert.equal(cycleMaterializationPhase(.25).grid,0);assert.equal(cycleMaterializationPhase(.55).solid,0);assert(cycleMaterializationPhase(.8).glow>.9);assert.deepEqual(cycleMaterializationPhase(1),{contours:1,grid:1,solid:1,glow:0});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
 await page.route('**/cycle-rez-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#020710"></body>'}));
 await page.goto('http://127.0.0.1:5173/cycle-rez-fixture');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{PovCycles}=await import('/src/rendering/pov-cycles.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0x020710);
  const root=new T.Group();scene.add(root);
  const source=new T.Group();source.userData.team=0;root.add(source);
  const rez={opacity:0,wire:{rezCut:{value:0}},bounds:{min:{z:-1.8},max:{z:1.8}}};
  const view=new PovCycles({root,bikes:[source],materializations:[rez]});
  const camera=new T.PerspectiveCamera(38,1000/700,.03,100);camera.position.set(4.6,2.5,4.8);camera.lookAt(0,.75,0);
  const {EffectComposer}=await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
  const {RenderPass}=await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
  const {UnrealBloomPass}=await import('/node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js');
  const {OutputPass}=await import('/node_modules/three/examples/jsm/postprocessing/OutputPass.js');
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
  const composer=new EffectComposer(renderer),bloom=new UnrealBloomPass(new T.Vector2(1000,700),.6,.5,.85),output=new OutputPass();
  composer.addPass(new RenderPass(scene,camera));composer.addPass(bloom);composer.addPass(output);
  window.setWheelReflection=(phase,strength)=>{source.userData.wheelReflection={phase,strength};};
  window.capturePhase=(progress,team=0,human=false)=>{
   source.userData.human=human;
   source.userData.team=team;
   source.userData.cycleFormationProgress=progress;
   view.prepare();view.edges.render(renderer,view.root,camera);composer.render();
   const result={rayVisible:view.proxies[0].visible,meshHidden:!source.visible,solid:view.proxies[0].material.uniforms.rezSolid.value,sweep:view.proxies[0].material.uniforms.rezSweep.value,depthWrite:view.proxies[0].material.depthWrite};
   view.restore();result.restored=source.visible;return result;
  };
  window.disposePreview=()=>{view.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();};
 });
 for(const [name,progress] of [['sweep',.2],['contours',.34],['grid',.6],['glow',.8],['settle',.92],['solid',1]]){
  const expected=cycleMaterializationPhase(progress);
  const phase=await page.evaluate(p=>capturePhase(p),progress);
  assert(phase.rayVisible&&phase.meshHidden&&phase.restored);assert.equal(phase.solid,expected.solid);assert.equal(phase.sweep,expected.contours);assert.equal(phase.depthWrite,expected.solid===1);
  await page.screenshot({path:`test-results/cycle-ray-rez-${name}.png`});
 }
 for(const team of [1,2,3]){
  await page.evaluate(team=>capturePhase(.6,team),team);
  await page.screenshot({path:`test-results/cycle-ray-rez-team-${team}.png`});
 }
 for(const progress of [.6,1]){
  await page.evaluate(p=>capturePhase(p,1,false),progress);const ai=await page.screenshot();
  await page.evaluate(p=>capturePhase(p,1,true),progress);const human=await page.screenshot({path:`test-results/cycle-human-rez-${progress}.png`});
  assert(!ai.equals(human),'human slash is visible in both wireframe and solid stages');
 }
 await page.evaluate(()=>{setWheelReflection(.25,1);capturePhase(1);});
 const glint=await page.screenshot({path:'test-results/cycle-wheel-glint-on.png'});
 await page.evaluate(()=>{setWheelReflection(.75,1);capturePhase(1);});
 const dark=await page.screenshot({path:'test-results/cycle-wheel-glint-off.png'});
 assert(!glint.equals(dark),'moving wheel reflections alternate visibly');
 await page.evaluate(()=>{setWheelReflection(.25,0);capturePhase(1);});
 const stopped=await page.screenshot();assert(stopped.equals(dark),'stopped wheels have no artificial reflection');
 await page.evaluate(()=>disposePreview());assert.deepEqual(errors,[]);
 console.log('Ray-cast sweep, wire, solid fade, mesh exclusion/restoration, depth state and shader compilation passed.');
}finally{await browser.close();}
