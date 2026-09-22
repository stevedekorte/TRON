import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/debris-shadow-fade',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto('http://127.0.0.1:5174/debris-shadow-fade');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');await (await import('/src/simulation/debris-physics.js')).debrisPhysicsReady;
  const {Breakups}=await import('/src/rendering/breakup.js'),fx=new Breakups(new T.Scene()),root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial()));
  fx.spawn({root},{x:0,y:5,s:0,yaw:0});const material=fx.bursts[0].materials.find(m=>m.uniforms?.fade);material.uniforms.fade.value=.6;
  const scene=new T.Scene(),floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshBasicMaterial({color:0x6688aa}));floor.rotation.x=-Math.PI/2;floor.renderOrder=-2;scene.add(floor);
  const geometry=new T.PlaneGeometry(10,10);geometry.rotateX(-Math.PI/2);
  const shadow=new T.Mesh(geometry,material);shadow.position.y=5;shadow.renderOrder=-1;shadow.frustumCulled=false;scene.add(shadow);
  const duplicate=shadow.clone();duplicate.visible=false;scene.add(duplicate);
  const camera=new T.OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(2.5,20,2.5);camera.lookAt(2.5,0,2.5);
  const renderer=new T.WebGLRenderer(),rt=new T.WebGLRenderTarget(200,200);
  const pixels=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const a=new Uint8Array(200*200*4);renderer.readRenderTargetPixels(rt,0,0,200,200,a);return a;};
  const single=pixels();duplicate.visible=true;const double=pixels();let changed=0;const tones=new Set();
  for(let i=0;i<single.length;i++)if(single[i]!==double[i])changed++;
  for(let y=90;y<110;y++)for(let x=90;x<110;x++)tones.add(single[(y*200+x)*4]);
  fx.dispose();renderer.dispose();rt.dispose();return {changed,tones:[...tones]};
 });assert.equal(result.changed,0);assert.equal(result.tones.length,1);assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
