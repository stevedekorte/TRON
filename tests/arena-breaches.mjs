import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/breach-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/breach-preview');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadArena}=await import('/src/rendering/arena.js');
  const {browserScenario}=await import('/src/game/browser-scenario.js');
  const arena=await loadArena(browserScenario({pathname:'/',search:'?layoutSeed=1982'}).world);
  arena.position.set(0,0,0);arena.userData.cycleRace.root.visible=false;
  const scene=new T.Scene();scene.background=new T.Color(0x030b17);scene.add(arena);scene.updateMatrixWorld(true);
  const ray=x=>new T.Raycaster(new T.Vector3(x,1,380),new T.Vector3(0,0,1)).intersectObject(arena.children[0],true).filter(h=>h.object.isMesh&&h.object.visible&&h.distance<100).length;
  const before=ray(0);const start=performance.now();
  arena.userData.breaches.update({round:1,breaches:[{axis:'z',sign:1,along:0}]});scene.updateMatrixWorld(true);
  const after=ray(0),adjacent=ray(16),ms=performance.now()-start;
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(55,1.5,.1,2000);camera.position.set(-20,26,340);camera.lookAt(0,25,416);renderer.render(scene,camera);
  window.nextMatch=()=>{arena.userData.breaches.update({round:2,breaches:[{axis:'z',sign:1,along:0}]});scene.updateMatrixWorld(true);return ray(0);};
  window.restore=()=>{arena.userData.breaches.update({round:3,breaches:[]});scene.updateMatrixWorld(true);return ray(0);};
  return {before,after,adjacent,ms};
 });
 assert(result.before>0);assert.equal(result.after,0);assert(result.adjacent>0);
 await page.screenshot({path:'test-results/arena-breach.png'});
 assert.equal(await page.evaluate(()=>nextMatch()),0);
 assert(await page.evaluate(()=>restore())>0);assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
