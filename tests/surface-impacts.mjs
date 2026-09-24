import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://127.0.0.1:5173/impact-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto('http://127.0.0.1:5173/impact-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {SurfaceImpacts}=await import('/src/rendering/surface-impacts.js');
  document.body.replaceChildren();const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,800/600,.1,200);camera.position.set(18,12,35);camera.lookAt(0,5,0);
  const wall=new T.Mesh(new T.BoxGeometry(50,30,2),new T.MeshBasicMaterial({color:0x102338}));wall.position.y=8;scene.add(wall);
  const effects=new SurfaceImpacts(scene);effects.spawn({x:0,y:5,s:-1,normal:{x:0,y:0,z:1}});effects.update(.3);renderer.render(scene,camera);
  const before=effects.effects[0].effect.mesh.quaternion.toArray();camera.position.x=-18;camera.lookAt(0,5,0);effects.update(0);renderer.render(scene,camera);
  const fixed=JSON.stringify(before)===JSON.stringify(effects.effects[0].effect.mesh.quaternion.toArray());
  window.fixture={renderer,scene,camera,effects,wall};return {fixed};
 });
 assert.ok(result.fixed);await page.screenshot({path:'test-results/surface-impact-wall.png'});
 await page.evaluate(()=>{const f=window.fixture;f.effects.clear();f.renderer.render(f.scene,f.camera);f.wall.geometry.dispose();f.wall.material.dispose();f.renderer.dispose();});
 assert.deepEqual(errors,[]);console.log('Surface-aligned rings render without shader errors and retain orientation across camera changes.');
}finally{await browser.close();}
