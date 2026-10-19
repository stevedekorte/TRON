import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/edges-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:black"></body>'}));
 await page.goto('http://127.0.0.1:5188/edges-check');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadRecognizer,createRecognizer}=await import('/src/rendering/models.js');
  const {Materialization}=await import('/src/rendering/materialization.js');
  const {disposeSceneResources}=await import('/src/rendering/scene-resources.js');
  const template=await loadRecognizer(),first=createRecognizer(template),warm=new Materialization(first.root);
  const craft=createRecognizer(template),effect=new Materialization(craft.root),scene=new T.Scene();scene.add(craft.root);
  const camera=new T.PerspectiveCamera(45,1000/700,.1,1000);camera.position.set(42,32,65);camera.lookAt(0,0,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  effect.update(2.4);renderer.render(scene,camera);
  const gl=renderer.getContext(),before=new Uint8Array(1000*700*4),after=new Uint8Array(before.length);gl.readPixels(0,0,1000,700,gl.RGBA,gl.UNSIGNED_BYTE,before);
  let vertices=0;
  for(const wire of effect.wires){const reference=new T.EdgesGeometry(wire.parent.geometry,25);const a=wire.geometry.attributes.position.array,b=reference.attributes.position.array;if(a.length!==b.length||a.some((v,i)=>v!==b[i]))throw Error('Wireframe geometry differs');vertices+=a.length/3;wire.geometry.dispose();wire.geometry=reference;}
  renderer.render(scene,camera);gl.readPixels(0,0,1000,700,gl.RGBA,gl.UNSIGNED_BYTE,after);
  if(before.some((v,i)=>v!==after[i]))throw Error('Rendered wireframe differs');
  window.cleanup=()=>{effect.dispose();warm.dispose();disposeSceneResources(scene);renderer.dispose();};
  return {vertices,litPixels:before.filter((v,i)=>i%4!==3&&v>20).length};
 });
 assert(result.vertices>0);assert(result.litPixels>100);await page.screenshot({path:'test-results/materialization-edges.png'});await page.evaluate(()=>cleanup());assert.deepEqual(errors,[]);console.log('Cached and original wireframe pixels identical:',result);
}finally{await browser.close();}
