import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/shadow-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/shadow-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createPovCycleMesh}=await import('/src/rendering/pov-cycles.js');
  const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const {updateCycleAircraftShadowUniforms}=await import('/src/rendering/cycle-aircraft-shadows.js');
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,800/600,.03,100);
  camera.position.set(4.6,2.5,4.8);camera.lookAt(0,.75,0);
  const bike=createPovCycleMesh();bike.visible=true;scene.add(bike);
  const caster=new T.Mesh(new T.BoxGeometry(12,.5,12),new T.MeshBasicMaterial());caster.position.set(-2,5,-2);
  const atlas=new RecognizerShadows([{root:caster,casters:[caster],radius:12,distance:30}],[],0);
  const u=bike.material.uniforms;
  window.renderShadow=enabled=>{
   caster.visible=enabled;atlas.update(renderer);updateCycleAircraftShadowUniforms(u,atlas);renderer.render(scene,camera);
   const gl=renderer.getContext(),pixels=new Uint8Array(800*600*4);gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum;
  };
  const lit=renderShadow(false),shadow=renderShadow(true),restored=renderShadow(false);
  // Force completion for a coarse CPU+GPU measurement, rather than timing submission alone.
  const bench=enabled=>{renderShadow(enabled);const start=performance.now();for(let i=0;i<12;i++){renderer.render(scene,camera);renderer.getContext().finish();}return (performance.now()-start)/12;};
  const timing={litMilliseconds:bench(false),shadowMilliseconds:bench(true)};
  window.shadowFixtureDispose=()=>{atlas.dispose();bike.geometry.dispose();bike.material.dispose();caster.geometry.dispose();caster.material.dispose();renderer.dispose();};
  return {lit,shadow,restored,timing,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
 });
 assert(result.shadow<result.lit*.9,'overhead caster must visibly darken ray-hit surfaces');
 assert.equal(result.restored,result.lit,'hiding the caster restores the original shading');
 await page.evaluate(()=>renderShadow(true));await page.screenshot({path:'test-results/cycle-aircraft-shadow.png'});
 await page.evaluate(()=>renderShadow(false));await page.screenshot({path:'test-results/cycle-aircraft-unshadowed.png'});
 await page.evaluate(()=>shadowFixtureDispose());assert.deepEqual(errors,[]);
 console.log('Aircraft atlas shadow reception and removal passed:',result);
}finally{await browser.close();}
