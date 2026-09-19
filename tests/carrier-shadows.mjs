import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/carrier-shadow-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5174/carrier-shadow-test');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{loadCarrier}=await import('/src/rendering/carrier.js'),{CarrierShadows}=await import('/src/rendering/carrier-shadows.js');
  const scene=new T.Scene(),carrier=await loadCarrier();carrier.position.set(0,360,0);scene.add(carrier);
  const floor=new T.Mesh(new T.PlaneGeometry(2600,2200),new T.MeshBasicMaterial({color:0x446699}));floor.material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 testGrid;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntestGrid=position.xy;');
   shader.fragmentShader='varying vec2 testGrid;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 cell=abs(fract(testGrid/40.+.5)-.5)*40.;float line=1.-smoothstep(1.,2.,min(cell.x,cell.y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),line);');
  };floor.rotation.x=-Math.PI/2;floor.renderOrder=-2;scene.add(floor);
  const slabs=new T.Mesh(new T.BoxGeometry(1000,70,250),new T.MeshBasicMaterial({color:0x7799bb}));slabs.position.set(160,35,170);scene.add(slabs);
  const seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(seams);
  const shadows=new CarrierShadows(carrier,{slabs,seams,floor},[]),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.setPixelRatio(1.5);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(48,1000/700,1,5000);camera.position.set(1200,1700,1500);camera.lookAt(0,0,0);
  const rt=new T.WebGLRenderTarget(1000,700),pixels=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const a=new Uint8Array(1000*700*4);renderer.readRenderTargetPixels(rt,0,0,1000,700,a);renderer.setRenderTarget(null);return a;};
  shadows.update(renderer);carrier.visible=false; // Keep only cast shadows for the comparison.
  shadows.strengths.fill(0);const before=pixels();shadows.strengths.fill(1);const after=pixels();let wall=0;
  for(let i=0;i<after.length;i+=4)if(before[i]>after[i]+8)wall++;
  carrier.visible=false;
  slabs.visible=false;shadows.strengths.fill(0);const clearGround=pixels();shadows.strengths.fill(1);const ground=pixels();let groundPixels=0,visibleGridPixels=0;
  for(let i=0;i<ground.length;i+=4){if(clearGround[i+2]>ground[i+2]+8)groundPixels++;if(clearGround[i]>240&&ground[i]>100&&ground[i]<225)visibleGridPixels++;}
  slabs.visible=true;renderer.render(scene,camera);return {wall,groundPixels,visibleGridPixels};
 });assert.ok(result.wall>500,JSON.stringify(result));assert.ok(result.groundPixels>1000,JSON.stringify(result));assert.ok(result.visibleGridPixels>100,JSON.stringify(result));assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/carrier-shadows.png'});console.log(result);
}finally{await browser.close();}
