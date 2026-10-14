import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/wall-edge-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/wall-edge-fixture',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const results=[];
 for(const mode of ['nearest','geometry']){
  results.push(await page.evaluate(async mode=>{
   const T=await import('/node_modules/three/build/three.module.js'),{mergeGeometries}=await import('/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'),{RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js');
   const scene=new T.Scene(),wall=new T.PlaneGeometry(150,100).translate(0,50,0),caster=new T.BoxGeometry(70,50,5);
   const transform=new T.Matrix4().makeRotationZ(.45);transform.setPosition(-20,80,-20);caster.applyMatrix4(transform);
   for(const [geometry,id] of [[wall,1],[caster,2]])geometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(id),1));
   const slabs=new T.Mesh(mergeGeometries([wall.toNonIndexed(),caster.toNonIndexed()]),new T.MeshBasicMaterial({color:0x6688aa,side:T.DoubleSide}));scene.add(slabs);
   const floor=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial()),seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());
   const shadows=mode==='geometry'?new MazeShadows({slabs,floor,seams}):new RecognizerShadows([{root:slabs,casters:[slabs],radius:650,distance:2000}],[slabs],0,{size:1024,excludeSelf:true,darkness:.4});
   if(shadows.floorShadow)shadows.floorShadow.visible=false;
   const renderer=new T.WebGLRenderer({stencil:true});renderer.setSize(1000,700);document.body.replaceChildren(renderer.domElement);
   const camera=new T.OrthographicCamera(-75,75,52.5,-52.5,.1,1000);camera.position.set(0,50,200);camera.lookAt(0,50,0);
   shadows.update(renderer);const target=new T.WebGLRenderTarget(1000,700,{stencilBuffer:true});renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(1000*700*4);renderer.readRenderTargetPixels(target,0,0,1000,700,pixels);renderer.setRenderTarget(null);renderer.render(scene,camera);
   // Compare against exact ray/box intersections, independently of shadow geometry.
   const inverse=transform.clone().invert(),box=new T.Box3(new T.Vector3(-35,-25,-2.5),new T.Vector3(35,25,2.5)),ray=new T.Ray(),hit=new T.Vector3();let wrong=0,shadowed=0;
   for(let y=20;y<680;y++)for(let x=0;x<1000;x++){
    ray.origin.set((x+.5)*150/1000-75,(y+.5)*105/700-2.5,0);ray.direction.set(-.5,1,-.5).normalize();ray.applyMatrix4(inverse);
    const expected=ray.intersectBox(box,hit)!==null,actual=pixels[(y*1000+x)*4]<27;
    if(actual)shadowed++;if(expected!==actual)wrong++;
   }
   const triangles=shadows.wallShadow?.geometry.attributes.position.count/3;
   return {mode,wrong,shadowed,triangles};
  },mode));await page.screenshot({path:`test-results/wall-edge-${mode}.png`});
 }
 assert.ok(results[0].wrong>100,JSON.stringify(results));assert.ok(results[1].wrong<30,JSON.stringify(results));assert.ok(results[1].shadowed>10000);assert.deepEqual(errors,[]);console.log(results);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createWorld}=await import('/src/rendering/world.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js'),{wallAt}=await import('/src/levels/maze.js');
  const scene=new T.Scene(),world=createWorld(scene),shadows=new MazeShadows(world),p=shadows.wallShadow.geometry.attributes.position;
  let best=null;scene.updateMatrixWorld(true);const raycaster=new T.Raycaster();
  for(let i=0;i<p.count;i+=3){
   const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2),n=b.clone().sub(a).cross(c.clone().sub(a)),area=n.length();n.normalize();
   const center=a.clone().add(b).add(c).multiplyScalar(1/3);
   if(Math.abs(n.y)>.1||center.y<12||center.y>50||Math.abs(center.x)>1800||Math.abs(center.z)>1800)continue;
   for(const sign of [-1,1]){
    const eye=center.clone().addScaledVector(n,sign*45);eye.y+=15;
    if(wallAt(eye.x,-eye.z))continue;
    const direction=center.clone().sub(eye);raycaster.set(eye,direction.clone().normalize());
    const hit=raycaster.intersectObject(world.slabs)[0];
    if(!hit||hit.distance<direction.length()-1)continue;
    if(!best||area>best.area)best={area,center,eye};
   }
  }
  if(!best)throw new Error('No vertical wall shadow found');
  const {center,eye}=best;
  const renderer=new T.WebGLRenderer({antialias:true,stencil:true});renderer.setSize(1000,700);document.body.replaceChildren(renderer.domElement);
  const camera=new T.PerspectiveCamera(65,1000/700,.1,20000);camera.position.copy(eye);camera.lookAt(center);shadows.update(renderer);renderer.render(scene,camera);
 });await page.screenshot({path:'test-results/wall-edge-maze.png'});assert.deepEqual(errors,[]);

}finally{await browser.close();}
