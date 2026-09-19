import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/maze-shadow-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/maze-shadow-test',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const changed=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createTank}=await import('/src/rendering/models.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const scene=new T.Scene(),tank=await createTank();tank.root.position.set(19,0,19);scene.add(tank.root);scene.add(new T.HemisphereLight(0xffffff,0x777777,3));
  const light=new T.DirectionalLight(0xffffff,3);light.position.set(-35,70,-35);scene.add(light);
  const slabs=new T.Mesh(new T.BoxGeometry(20,54,20),new T.MeshBasicMaterial());slabs.position.y=27;scene.add(slabs);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshBasicMaterial()),seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(floor,seams);
  const shadows=new MazeShadows({slabs,floor,seams},[tank.root]),renderer=new T.WebGLRenderer({antialias:true,stencil:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.setPixelRatio(1.5);document.body.append(renderer.domElement);shadows.update(renderer);
  slabs.visible=floor.visible=seams.visible=false;
  const camera=new T.PerspectiveCamera(40,1000/700,.1,1000);camera.position.set(33,13,36);camera.lookAt(19,1,19);
  const rt=new T.WebGLRenderTarget(1000,700,{stencilBuffer:true}),pixels=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const a=new Uint8Array(1000*700*4);renderer.readRenderTargetPixels(rt,0,0,1000,700,a);renderer.setRenderTarget(null);return a;};
  shadows.strengths.fill(0);shadows.floorShadow.visible=false;const before=pixels();shadows.strengths.fill(1);shadows.floorShadow.visible=true;shadows.floorShadow.visible=false;const after=pixels();let changed=0;
  for(let i=0;i<after.length;i+=4)if(before[i]+before[i+1]+before[i+2]>after[i]+after[i+1]+after[i+2]+8)changed++;
  floor.visible=true;shadows.floorShadow.visible=true;floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.renderOrder=-2;
  const vehicleShadows=[];tank.root.traverse(o=>{if(o.isMesh&&o.userData.breakupExclude&&o.renderOrder===-1)vehicleShadows.push(o);});
  vehicleShadows.forEach(o=>o.visible=false);const bare=pixels();vehicleShadows.forEach(o=>o.visible=true);const layered=pixels();let silhouette=0;
  for(let i=0;i<layered.length;i+=4)if(bare[i+2]>layered[i+2]+8) silhouette++;
  renderer.render(scene,camera);return {changed,silhouette,layerOrder:vehicleShadows.every(o=>o.renderOrder>floor.renderOrder)};
 });assert.ok(changed.changed>300,JSON.stringify(changed));assert.ok(changed.silhouette>100,JSON.stringify(changed));assert.ok(changed.layerOrder);await page.screenshot({path:'test-results/maze-shadow-on-tank.png'});assert.deepEqual(errors,[]);console.log({shadowedTankPixels:changed});
}finally{await browser.close();}
