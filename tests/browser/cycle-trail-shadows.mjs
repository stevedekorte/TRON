import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/trail-shadow-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/trail-shadow-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {LightCycleWalls}=await import('/src/rendering/light-cycle-walls.js');
  const {CycleTrailShadows}=await import('/src/rendering/cycle-trail-shadows.js');
  const {createArenaFloor}=await import('/src/rendering/arena-floor.js');
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true,stencil:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  const scene=new T.Scene(),root=new T.Group();scene.add(root);root.position.x=6000;
  const walls=new LightCycleWalls(root),floor=createArenaFloor({elevationMeters:0});floor.position.x=6000;floor.renderOrder=-1.8;scene.add(floor);
  const transform=new T.Object3D();
  for(let i=0;i<2;i++){
   const mesh=walls.meshes[i];mesh.count=1;
   transform.position.set(i*.5,.771,0);transform.rotation.y=-Math.PI/2;transform.scale.set(12,1.5,.18);transform.updateMatrix();
   mesh.setMatrixAt(0,transform.matrix);mesh.geometry.attributes.trailDistance.setXY(0,12,1e6);mesh.geometry.attributes.trailPattern.setXYZ(0,0,0,12);mesh.instanceMatrix.needsUpdate=true;
  }
  const shadow=new CycleTrailShadows(root,walls.meshes,[floor]);
  const camera=new T.PerspectiveCamera(40,1000/700,.03,2000);camera.position.set(6005,3.2,7);camera.lookAt(6000,.6,0);
  const capture=(kind,enabled)=>{
   floor.visible=kind==='floor';root.visible=kind!=='floor';shadow.strengths[0]=enabled?1:0;renderer.render(scene,camera);
   const gl=renderer.getContext(),pixels=new Uint8Array(1000*700*4);gl.readPixels(0,0,1000,700,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum;
  };
  shadow.update(renderer);
  const floorLit=capture('floor',false),floorShadow=capture('floor',true);
  const wallsLit=capture('walls',false),wallsShadow=capture('walls',true);
  root.visible=true;walls.meshes[1].count=0;shadow.update(renderer);
  const singleLit=capture('walls',false),singleShadow=capture('walls',true);
  // A shrinking trail changes both its surface and the instanced depth pass.
  root.visible=true;walls.meshes[1].count=1;
  transform.position.set(0,.171,0);transform.scale.set(12,.3,.18);transform.updateMatrix();walls.meshes[0].setMatrixAt(0,transform.matrix);walls.meshes[0].instanceMatrix.needsUpdate=true;
  shadow.update(renderer);const collapsedFloor=capture('floor',true);
  root.visible=true;for(const mesh of walls.meshes)mesh.count=0;shadow.update(renderer);
  const clearedFloor=capture('floor',true);
  renderer.info.reset();root.visible=false;shadow.update(renderer);const idleCalls=renderer.info.render.calls;
  window.showTrailShadow=()=>{root.visible=true;walls.meshes[0].count=walls.meshes[1].count=1;transform.position.set(0,.771,0);transform.scale.set(12,1.5,.18);transform.updateMatrix();walls.meshes[0].setMatrixAt(0,transform.matrix);walls.meshes[0].instanceMatrix.needsUpdate=true;shadow.update(renderer);floor.visible=true;renderer.render(scene,camera);};
  window.disposeTrailShadow=()=>{shadow.dispose();for(const mesh of walls.meshes){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}floor.geometry.dispose();floor.material.dispose();renderer.dispose();};
  return {floorLit,floorShadow,wallsLit,wallsShadow,singleLit,singleShadow,collapsedFloor,clearedFloor,idleCalls};
 });
 assert(result.floorShadow<result.floorLit,'trails shadow the grid floor');
 assert.equal(result.wallsShadow,result.wallsLit,'trails do not receive shadows from other trails');
 assert.equal(result.singleShadow,result.singleLit,'an isolated straight trail has no false self-shadow acne');
 assert(result.collapsedFloor>result.floorShadow,'collapsing caster shortens floor shadows');
 assert.equal(result.clearedFloor,result.floorLit,'last removed trail leaves no stale floor shadow');
 assert.equal(result.idleCalls,0,'idle trails do not redraw');
 await page.evaluate(()=>showTrailShadow());await page.screenshot({path:'test-results/cycle-trail-shadow.png'});
 await page.evaluate(()=>disposeTrailShadow());
 assert.deepEqual(errors,[]);console.log('Trail floor shadows, unshadowed walls, collapse and removal:',result);
}finally{await browser.close();}
