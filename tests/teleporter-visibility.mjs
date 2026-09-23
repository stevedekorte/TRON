import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:400,height:400}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/pad-visibility-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(new URL('/pad-visibility-fixture',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createScenario}=await import('/src/levels/scenario.js');
  const {createTeleportPads}=await import('/src/levels/teleporters.js');
  const {createTeleporters}=await import('/src/rendering/teleporters.js');
  const {createWorld}=await import('/src/rendering/world.js');
  const {disposeSceneResources}=await import('/src/rendering/scene-resources.js');
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(400,400);document.body.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-42,42,42,-42,.1,200),results=[];
  camera.up.set(0,0,-1);
  const pixels=new Uint8Array(400*400*4),gl=renderer.getContext();
  const redCount=()=>{gl.readPixels(0,0,400,400,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i]>pixels[i+1]*2&&pixels[i]>pixels[i+2]*2)red++;return red;};
  for(const options of [{layout:'blueprint',layoutSeed:1982},{layout:'blueprint',layoutSeed:99},{layout:'authored',layoutSeed:7},{layout:'authored',layoutSeed:1982,siteCount:1}]){
   const {world}=createScenario(options),scene=new T.Scene(),visual=createWorld(scene,world);
   const pads=createTeleportPads(world.MAZE_INSTANCES,world.WALL_HEIGHT),effect=createTeleporters(visual.floor.material,pads);effect.update(pads,0);
   const counts=[];
   for(const pad of pads){camera.position.set(pad.x,90,-pad.s);camera.lookAt(pad.x,0,-pad.s);renderer.render(scene,camera);counts.push(redCount());}
   effect.visible=false;renderer.render(scene,camera);const hidden=redCount();
   results.push({options,counts,hidden});disposeSceneResources(scene);
  }
  renderer.dispose();return results;
 });
 for(const result of results){assert(result.counts.every(n=>n>300),JSON.stringify(result));assert.equal(result.hidden,0);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
}finally{await browser.close();}
