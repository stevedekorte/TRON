import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/arena-shadow-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/arena-shadow-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {ProjectedFloorShadows}=await import('/src/rendering/projected-floor-shadows.js');
  const {ArenaWallShadows,arenaCycleShadows}=await import('/src/rendering/arena-wall-shadows.js');
  const {cutBreachGeometry}=await import('/src/rendering/arena-breaches.js');
  const {createArenaFloor}=await import('/src/rendering/arena-floor.js');
  const {createPovCycleMesh}=await import('/src/rendering/pov-cycles.js');
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true,stencil:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,800/600,.03,2000);
  const offset=6000,wallX=-409.06,bikeX=wallX+1.5;
  camera.position.set(offset+bikeX+4.6,2.5,4.8);camera.lookAt(offset+bikeX,.75,0);
  const floor=createArenaFloor({elevationMeters:0});floor.position.x=offset;floor.renderOrder=-1.8;scene.add(floor);
  const normal=new T.Mesh(new T.BoxGeometry(1,1,3),new T.MeshBasicMaterial({color:0xe6bd14}));normal.position.set(offset+bikeX,.5,0);scene.add(normal);
  const ray=createPovCycleMesh();ray.position.set(offset+bikeX,0,0);scene.add(ray);
  const architecture=new T.Group();architecture.position.x=offset;
  const wall=new T.Mesh(new T.BoxGeometry(4,50,60),new T.MeshBasicMaterial());wall.position.set(wallX-2,25,0);architecture.add(wall);
  const container=new T.Group();container.add(architecture);scene.add(container);wall.layers.set(1);
  const original=wall.geometry;
  const atlas=new ArenaWallShadows(architecture,[normal]);
  const floorShadows=new ProjectedFloorShadows(architecture,[wall],[floor]);
  const capture=kind=>{
   floorShadows.update();
   floor.visible=kind==='floor';normal.visible=kind==='normal';ray.visible=kind==='ray';
   arenaCycleShadows.update(ray.material.uniforms,atlas);renderer.render(scene,camera);
   const gl=renderer.getContext(),pixels=new Uint8Array(800*600*4);gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum;
  };
  const all=()=>Object.fromEntries(['floor','normal','ray'].map(kind=>[kind,capture(kind)]));
  atlas.update(renderer);const shadow=all();
  renderer.info.reset();atlas.update(renderer);const cachedCalls=renderer.info.render.calls;
  wall.visible=false;atlas.update(renderer);const lit=all();
  wall.visible=true;atlas.update(renderer);const restored=all();
  architecture.updateWorldMatrix(true,true);
  wall.geometry=cutBreachGeometry(original,wall.matrix,{axis:'x',sign:-1,along:0});atlas.update(renderer);const breach=all();
  const cut=wall.geometry;wall.geometry=original;atlas.update(renderer);const reset=all();cut.dispose();
  window.captureArenaShadow=kind=>capture(kind);
  window.disposeArenaShadow=()=>{floorShadows.dispose();atlas.dispose();normal.geometry.dispose();normal.material.dispose();ray.geometry.dispose();ray.material.dispose();floor.geometry.dispose();floor.material.dispose();original.dispose();wall.material.dispose();renderer.dispose();};
  return {shadow,lit,restored,breach,reset,cachedCalls};
 });
 for(const kind of ['floor','normal','ray']){
  assert(result.shadow[kind]<result.lit[kind]*.95,`${kind} receives wall shadow`);
  assert.equal(result.restored[kind],result.shadow[kind],`${kind} restores shadow when wall returns`);
  assert(result.breach[kind]>result.shadow[kind],`${kind} receives light through real cut geometry`);
  assert.equal(result.reset[kind],result.shadow[kind],`${kind} restores shadow on geometry reset`);
 }
 assert.equal(result.cachedCalls,0,'unchanged walls do not redraw the shadow map');
 await page.evaluate(()=>captureArenaShadow('ray'));await page.screenshot({path:'test-results/arena-wall-shadow-ray.png'});
 await page.evaluate(()=>captureArenaShadow('floor'));await page.screenshot({path:'test-results/arena-wall-shadow-floor.png'});
 await page.evaluate(()=>disposeArenaShadow());assert.deepEqual(errors,[]);console.log('Arena wall shadows:',result);
}finally{await browser.close();}
