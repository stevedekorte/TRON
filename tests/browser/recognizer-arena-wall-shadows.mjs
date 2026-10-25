import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/aircraft-wall-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/aircraft-wall-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const {styleArena}=await import('/src/rendering/arena-style.js');
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
  const scene=new T.Scene(),wall=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshBasicMaterial());wall.position.set(6000,10,0);scene.add(wall);
  const style=styleArena(wall,{wallColor:0x204a26});
  const receiver={material:wall.material,geometry:wall.geometry,userData:{arenaAircraftShadow:true},isMesh:true};
  const caster=new T.Mesh(new T.BoxGeometry(8,6,.5),new T.MeshBasicMaterial());caster.position.set(5997,13,-3);
  const craft={root:caster,casters:[caster],radius:20,distance:40};
  const options={darknessForReceiver:r=>r.userData.arenaAircraftShadow?.98:undefined};
  let atlas=new RecognizerShadows([craft],[],0,options);
  atlas.addReceivers([receiver]);atlas.addReceivers([receiver]);const patches=atlas.patches.length;
  const camera=new T.PerspectiveCamera(45,800/600,.1,100);camera.position.set(6000,10,30);camera.lookAt(6000,10,0);
  const capture=strength=>{
   atlas.strengths[0]=strength;renderer.render(scene,camera);
   const gl=renderer.getContext(),pixels=new Uint8Array(800*600*4);gl.readPixels(0,0,800,600,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=pixels[i]+pixels[i+1]+pixels[i+2];return sum;
  };
  atlas.update(renderer);const lit=capture(0),ordinary=capture(.78/.98),dark=capture(1);
  atlas.dispose();atlas=new RecognizerShadows([craft],[receiver],0,options);atlas.update(renderer);const rebuilt=capture(1);
  window.showWallShadow=()=>capture(1);
  window.disposeWallShadow=()=>{atlas.dispose();style.dispose();wall.geometry.dispose();wall.material.dispose();caster.geometry.dispose();caster.material.dispose();renderer.dispose();};
  return {lit,ordinary,dark,rebuilt,patches};
 });
 assert(result.dark<result.ordinary&&result.ordinary<result.lit);assert.equal(result.rebuilt,result.dark);assert.equal(result.patches,1);
 await page.evaluate(()=>showWallShadow());await page.screenshot({path:'test-results/recognizer-arena-wall-shadow.png'});
 await page.evaluate(()=>disposeWallShadow());assert.deepEqual(errors,[]);console.log('Late arena receivers, darker aircraft shadows and atlas rebuild:',result);
}finally{await browser.close();}
