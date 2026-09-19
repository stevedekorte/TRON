import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/cloud-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5174/cloud-test');
const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{CloudLayer,loadCloud,cloudPose,CLOUDS,CLOUD_BOUNDS}=await import('/src/rendering/cloud-layer.js'),{SPAWN}=await import('/src/levels/maze.js');
 const scene=new T.Scene();scene.background=new T.Color(0x03050c);const layer=new CloudLayer(await loadCloud(),scene);layer.update(0,42,true);
 const period=(CLOUD_BOUNDS.maxX-CLOUD_BOUNDS.minX)/CLOUDS.speed,p=cloudPose(0,0,42),q=cloudPose(0,10,42),r=cloudPose(0,period,42);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(63,1400/900,.15,2500);camera.position.set(p.x,5,p.z+1800);camera.lookAt(p.x,p.y,p.z);renderer.render(scene,camera);
 const gl=renderer.getContext(),pixels=new Uint8Array(1400*900*4);gl.readPixels(0,0,1400,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let visiblePixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>60&&pixels[i+2]>60)visiblePixels++;
 const initial=Array.from(layer.mesh.instanceMatrix.array);layer.update(0,42,true);const stable=initial.every((v,i)=>v===layer.mesh.instanceMatrix.array[i]);
 layer.update(period,42,true);layer.update(0,42,true);const reset=initial.every((v,i)=>v===layer.mesh.instanceMatrix.array[i]);
 let overlaps=0;
 const bounds=layer.mesh.geometry.boundingBox||new T.Box3().setFromBufferAttribute(layer.mesh.geometry.attributes.position);
 for(let seed=0;seed<50;seed++)for(let n=0;n<100;n++){
  const boxes=Array.from({length:CLOUDS.count},(_,i)=>{const pose=cloudPose(i,period*n/17,seed),matrix=new T.Matrix4().compose(new T.Vector3(pose.x,pose.y,pose.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),pose.yaw),new T.Vector3().setScalar(pose.scale));return bounds.clone().applyMatrix4(matrix);});
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)if(boxes[a].intersectsBox(boxes[b]))overlaps++;
 }
 const aligned=Array.from({length:CLOUDS.count},(_,i)=>[cloudPose(i,0,42),cloudPose(i,period,42)]).flat().every(pose=>pose.yaw===CLOUDS.yaw);
 return {p,q,r,overlaps,aligned,stable,reset,visiblePixels,count:layer.mesh.count,shadows:layer.mesh.castShadow||layer.mesh.receiveShadow};
});await page.screenshot({path:'test-results/cloud-layer.png'});console.log({result,errors});assert.equal(result.count,3);assert.equal(result.overlaps,0);assert.equal(result.p.y,1080);assert.ok(result.aligned);assert.ok(Math.abs(result.q.x-result.p.x-60)<1e-7);assert.ok(Math.abs(result.r.x-result.p.x)<1e-7);assert.notEqual(result.p.z,result.r.z);assert.ok(result.stable&&result.reset);assert.equal(result.shadows,false);assert.ok(result.visiblePixels>100,JSON.stringify(result));await page.screenshot({path:'test-results/cloud-layer.png'});
await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('Escape');assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
