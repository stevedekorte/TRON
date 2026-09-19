import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/shadow-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5174/shadow-check');
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createTank}=await import('/src/rendering/models.js');
  const tank=await createTank(),scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true});scene.background=new T.Color(0x355573);renderer.setSize(640,480);document.body.append(renderer.domElement);
  const floor=new T.Mesh(new T.PlaneGeometry(40000,40000),new T.MeshBasicMaterial({color:0x355573}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.renderOrder=-2;scene.add(floor,tank.root);
  // Isolate the projected silhouette to count floor leaks without confusing
  // the tank's dark body with the shadow. Use the actual model shader/batches.
  tank.root.traverse(o=>{if(o.isMesh)o.visible=o.material.isShaderMaterial===true;});
  const camera=new T.PerspectiveCamera(48,640/480,.15,12000),gl=renderer.getContext(),pixels=new Uint8Array(640*480*4),results=[];
  for(const height of [3,12,150]){
   const counts=[];
   for(let i=0;i<24;i++){
    const x=7000+i*.17,z=-6000+i*.23;tank.root.position.set(x,0,z);floor.position.set(x,-.06,z);camera.position.set(x+14,height,z+20);camera.lookAt(x,0,z);camera.updateMatrixWorld();renderer.render(scene,camera);gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let dark=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p]<15&&pixels[p+1]<15&&pixels[p+2]<30)dark++;counts.push(dark);
   }
   results.push({height,min:Math.min(...counts),max:Math.max(...counts)});
  }
  return results;
 });
 for(const r of results){assert.ok(r.min>30);assert.ok((r.max-r.min)/r.min<.025,JSON.stringify(r));}
 await page.screenshot({path:'test-results/shadow-stability.png'});assert.deepEqual(errors,[]);console.log(results);
}finally{await browser.close();}
