import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/preti-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5173/preti-preview');
 const stats=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const gltf=await new GLTFLoader().loadAsync('/docs/models/preti_light_cycle_arena.glb'),scene=new T.Scene();scene.background=new T.Color(0x01040a);scene.add(gltf.scene);
  const {styleArena}=await import('/src/rendering/arena-style.js');const style=styleArena(gltf.scene);
  const {createArenaFloor}=await import('/src/rendering/arena-floor.js');scene.add(createArenaFloor());
  scene.add(new T.HemisphereLight(0xffffff,0x667788,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(200,800,500);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,1000);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1.5,.1,10000);
  window.captureArena=(inside=false)=>{camera.position.set(...(inside?[0,5,260]:[700,850,850]));camera.lookAt(...(inside?[0,18,-430]:[0,0,0]));renderer.render(scene,camera);};captureArena();
  let meshes=0,triangles=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  return {edgeSegments:style.edgeSegments,meshes,triangles,size:new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3()).toArray()};
 });
 await page.screenshot({path:'docs/models/preti-light-cycle-arena-preview.png'});await page.evaluate(()=>captureArena(true));await page.screenshot({path:'docs/models/preti-light-cycle-arena-interior.png'});
 assert.deepEqual(errors,[]);assert(stats.triangles<12000);assert(stats.meshes<150);assert(stats.edgeSegments>0);console.log(stats);
}finally{await browser.close();}
