import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 await page.route('**/*cloudflareinsights.com/**',r=>r.fulfill({status:204,body:''}));
 if(process.env.TRON_CONTAINER){await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(120000);}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/maze-grid-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/maze-grid-test',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const scene=new T.Scene();
  const floor=new T.Mesh(new T.PlaneGeometry(1200,1000),new T.MeshBasicMaterial({color:0x446699}));floor.material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 testGrid;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntestGrid=position.xy;');
   shader.fragmentShader='varying vec2 testGrid;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 cell=abs(fract(testGrid/24.+.5)-.5)*40.;float line=1.-smoothstep(1.,2.,min(cell.x,cell.y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),line);');
  };floor.rotation.x=-Math.PI/2;floor.renderOrder=-2;scene.add(floor);
  const slabs=new T.Mesh(new T.BoxGeometry(500,200,250),new T.MeshBasicMaterial({color:0x7799bb}));slabs.geometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(slabs.geometry.attributes.position.count).fill(1),1));slabs.position.set(0,100,0);scene.add(slabs);
  const seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(seams);
  const shadows=new MazeShadows({slabs,seams,floor}),renderer=new T.WebGLRenderer({antialias:true,stencil:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.setPixelRatio(1.5);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1000/700,1,5000);camera.position.set(500,600,600);camera.lookAt(0,0,0);
  const rt=new T.WebGLRenderTarget(1000,700,{stencilBuffer:true}),pixels=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const a=new Uint8Array(1000*700*4);renderer.readRenderTargetPixels(rt,0,0,1000,700,a);renderer.setRenderTarget(null);return a;};
  shadows.update(renderer); // Keep only cast shadows for the comparison.
  shadows.strengths.fill(0);shadows.floorShadow.visible=false;const before=pixels();shadows.strengths.fill(1);shadows.floorShadow.visible=true;const after=pixels();let wall=0;
  for(let i=0;i<after.length;i+=4)if(before[i]>after[i]+8)wall++;

  slabs.visible=false;shadows.strengths.fill(0);shadows.floorShadow.visible=false;const clearGround=pixels();shadows.strengths.fill(1);shadows.floorShadow.visible=true;const ground=pixels();
  const duplicate=shadows.floorShadow.clone();duplicate.matrix.copy(slabs.matrixWorld);scene.add(duplicate);
  const overlap=pixels();let overlapDifferences=0;for(let i=0;i<ground.length;i++)if(ground[i]!==overlap[i])overlapDifferences++;scene.remove(duplicate);
  let groundPixels=0,visibleGridPixels=0;
  for(let i=0;i<ground.length;i+=4){if(clearGround[i+2]>ground[i+2]+8)groundPixels++;if(clearGround[i]>240&&ground[i]>100&&ground[i]<225)visibleGridPixels++;}
  slabs.visible=true;renderer.render(scene,camera);return {wall,groundPixels,visibleGridPixels,overlapDifferences};
 });assert.equal(result.overlapDifferences,0);assert.ok(result.wall>500,JSON.stringify(result));assert.ok(result.groundPixels>1000,JSON.stringify(result));assert.ok(result.visibleGridPixels>100,JSON.stringify(result));assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/maze-grid-shadows.png'});console.log(result);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createWorld}=await import('/src/rendering/world.js'),{MazeShadows}=await import('/src/rendering/maze-shadows.js'),{WALLS}=await import('/src/levels/maze.js');
  const scene=new T.Scene(),world=createWorld(scene),shadows=new MazeShadows(world);
  const tip=WALLS.filter(w=>w.mazeId===0).flatMap(w=>w.points).sort((a,b)=>b.x-a.x)[0];
  const renderer=new T.WebGLRenderer({antialias:true,stencil:true});renderer.setSize(1000,700);renderer.setPixelRatio(1.5);document.body.replaceChildren(renderer.domElement);
  const camera=new T.PerspectiveCamera(55,1000/700,.1,20000);camera.position.set(tip.x+100,40,-tip.s+110);camera.lookAt(tip.x-15,12,-tip.s);
  shadows.update(renderer);renderer.render(scene,camera);
 });await page.screenshot({path:'test-results/maze-grid-production.png'});assert.deepEqual(errors,[]);
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.waitForFunction(()=>window.__tron);if(process.env.TRON_CONTAINER)await page.evaluate(()=>__tron.configure({renderScale:.5,bloom:0}));await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__tron?.state.mode==='running');
 await page.keyboard.press('KeyW');
 await page.evaluate(async()=>{
  const {WALLS}=await import('/src/levels/maze.js');const tip=WALLS.filter(w=>w.mazeId===0).flatMap(w=>w.points).sort((a,b)=>b.x-a.x)[0];
  __tron.place({x:tip.x+80,s:tip.s-70,yaw:Math.PI*.75,speed:0,cruiseThrottle:false});
 });await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.screenshot({path:'test-results/maze-grid-game.png'});assert.deepEqual(errors,[]);
}finally{await browser.close();}
