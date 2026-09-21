import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/carrier-shadow-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto(new URL('/carrier-shadow-test',process.env.TRON_URL||'http://127.0.0.1:5173').href);
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
 const edges=[];
 for(const mode of ['old','filtered','smooth']){
  const samples=await page.evaluate(async mode=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js'),{CARRIER_SHADOWS}=await import('/src/rendering/carrier-shadows.js');
   const scene=new T.Scene(),receiver=new T.Mesh(new T.PlaneGeometry(150,110),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}));receiver.position.y=50;scene.add(receiver);
   const transform=new T.Matrix4().makeRotationZ(.45);transform.setPosition(-20,80,-20);
   const root=new T.Group(),caster=new T.Mesh(new T.BoxGeometry(70,50,5).applyMatrix4(transform));root.add(caster);
   const shadows=new RecognizerShadows([{root,casters:[caster],radius:750,distance:1800}],[receiver],0,mode==='old'?{size:1024,darkness:.5}:{...CARRIER_SHADOWS,filterEdges:mode==='smooth'?'soft':true});
   const renderer=new T.WebGLRenderer();renderer.setSize(1000,700);document.body.replaceChildren(renderer.domElement);
   const camera=new T.OrthographicCamera(-75,75,52.5,-52.5,.1,1000);camera.position.set(0,50,200);camera.lookAt(0,50,0);
   const target=new T.WebGLRenderTarget(1000,700),pixels=new Uint8Array(1000*700*4),results=[];
   for(const shift of [0,20]){
    root.position.x=shift;shadows.update(renderer);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,1000,700,pixels);renderer.setRenderTarget(null);renderer.render(scene,camera);
    const inverse=new T.Matrix4().makeTranslation(shift,0,0).multiply(transform).invert(),box=new T.Box3(new T.Vector3(-35,-25,-2.5),new T.Vector3(35,25,2.5)),ray=new T.Ray(),hit=new T.Vector3();const expectedMask=new Uint8Array(1000*700);let wrong=0,shadowed=0,partial=0;
    for(let y=20;y<680;y++)for(let x=0;x<1000;x++){
     ray.origin.set((x+.5)*150/1000-75,(y+.5)*105/700-2.5,0);ray.direction.set(-.5,1,-.5).normalize();ray.applyMatrix4(inverse);
     const expected=ray.intersectBox(box,hit)!==null,value=pixels[(y*1000+x)*4],actual=value<225;
     expectedMask[y*1000+x]=Number(expected);if(actual)shadowed++;if(expected!==actual)wrong++;if(value>190&&value<253)partial++;
    }
    // A soft edge legitimately differs from a binary ray mask near the
    // boundary; require agreement outside a narrow 1.8 m transition band.
    let wrongFar=0;
    for(let y=40;y<660;y++)for(let x=12;x<988;x++){
     const expected=expectedMask[y*1000+x],actual=Number(pixels[(y*1000+x)*4]<225);
     if(expected===actual)continue;
     const nearBoundary=[[-12,0],[12,0],[0,-12],[0,12],[-12,-12],[12,12],[-12,12],[12,-12]].some(([dx,dy])=>expectedMask[(y+dy)*1000+x+dx]!==expected);
     if(!nearBoundary)wrongFar++;
    }
    // Subpixel contour roughness on a straight part of the upper edge.
    const contour=[];
    for(let x=400;x<550;x++)for(let y=679;y>20;y--){
     const value=pixels[(y*1000+x)*4],above=pixels[((y+1)*1000+x)*4];
     if(value<225&&above>=225){contour.push({x,y:y+(225-value)/(above-value)});break;}
    }
    const n=contour.length,mx=contour.reduce((a,p)=>a+p.x,0)/n,my=contour.reduce((a,p)=>a+p.y,0)/n;
    const slope=contour.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0)/contour.reduce((a,p)=>a+(p.x-mx)**2,0);
    const roughness=Math.sqrt(contour.reduce((a,p)=>a+(p.y-my-slope*(p.x-mx))**2,0)/n);
    results.push({shift,wrong,shadowed,partial,roughness,wrongFar});
   }
   shadows.dispose();target.dispose();return results;
  },mode);edges.push({mode,samples});await page.screenshot({path:`test-results/carrier-edge-${mode}.png`});
 }
 for(let i=0;i<2;i++){
  assert.ok(edges[1].samples[i].wrong<edges[0].samples[i].wrong*.45,JSON.stringify(edges));
  assert.ok(edges[1].samples[i].partial>100,JSON.stringify(edges));
  assert.ok(edges[1].samples[i].shadowed>10000,JSON.stringify(edges));
  assert.ok(edges[2].samples[i].wrongFar===0,JSON.stringify(edges));
  assert.ok(edges[2].samples[i].roughness<edges[1].samples[i].roughness*.85,JSON.stringify(edges));
 }
 assert.deepEqual(errors,[]);console.log('Independent ray/box comparison, including moving caster:',JSON.stringify(edges));
}finally{await browser.close();}
