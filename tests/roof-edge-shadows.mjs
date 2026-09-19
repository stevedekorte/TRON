import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const baseUrl=process.env.TRON_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/receiver-plane-test',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto(new URL('/receiver-plane-test',baseUrl).href);
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const renderer=new T.WebGLRenderer(),scene=new T.Scene(),plane=new T.Mesh(new T.BoxGeometry(100,60,20,5,3,1),new T.MeshBasicMaterial({color:0x557799,side:T.DoubleSide}));plane.geometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(plane.geometry.attributes.position.count).fill(1208),1));scene.add(plane);
  const shadows=new RecognizerShadows([{root:plane,casters:[plane],radius:100}],[plane],0,{size:512,excludeSelf:true});
  const camera=new T.PerspectiveCamera(60,1,.1,1000),rt=new T.WebGLRenderTarget(400,400),results=[];
  const pixels=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const a=new Uint8Array(400*400*4);renderer.readRenderTargetPixels(rt,0,0,400,400,a);renderer.setRenderTarget(null);return a;};
  for(const offset of [0,7000])for(const yaw of [-1.2,-.5,0,.7,1.3])for(const angle of [-.9,0,.9]){
   plane.position.set(offset,30,-offset);plane.rotation.y=yaw;
   const cameraOffset=new T.Vector3(Math.sin(angle)*70,5,Math.cos(angle)*70).applyAxisAngle(new T.Vector3(0,1,0),yaw);
   camera.position.copy(plane.position).add(cameraOffset);camera.lookAt(plane.position);
   shadows.update(renderer);shadows.strengths.fill(0);const before=pixels();shadows.strengths.fill(1);const after=pixels();let changed=0;
   for(let i=0;i<before.length;i+=4)if(before[i+2]>after[i+2]+3)changed++;
   results.push({offset,yaw,angle,changed});
  }
  shadows.dispose();rt.dispose();renderer.dispose();return results;
 });assert.ok(results.every(r=>r.changed===0),JSON.stringify(results.filter(r=>r.changed)));assert.deepEqual(errors,[]);console.log(`${results.length} closed roof-edge receiver poses, including distant coordinates: zero self-shadowed pixels.`);
}finally{await browser.close();}
