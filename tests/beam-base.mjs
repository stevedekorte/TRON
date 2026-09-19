import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/beam-base-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5174/beam-base-test');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{DataBeams}=await import('/src/rendering/data-beams.js');
  const scene=new T.Scene(),beams=new DataBeams(scene),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(640,480);document.body.append(renderer.domElement);
  const floor=new T.Mesh(new T.PlaneGeometry(40000,40000),new T.MeshBasicMaterial({color:0x19304b}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.renderOrder=-2;scene.add(floor);
  const group=beams.beams[0],{pool,curtain}=group.userData.effects,run={time:2,dataBeams:[{x:7000,s:6000,transferX:7006,transferS:6000,transferStartedAt:0,collectedAt:null}]};beams.update(run,true);const centered=curtain.position.length()===0;
  group.children.forEach(o=>o.visible=o===pool);pool.material.color.setHex(0xff2008);
  const camera=new T.PerspectiveCamera(48,640/480,.15,12000),gl=renderer.getContext(),pixels=new Uint8Array(640*480*4);
  function count(){renderer.render(scene,camera);gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>pixels[i+1]+25)red++;return red;}
  const results=[];
  for(const height of [3,12,150]){
   const counts=[];for(let i=0;i<24;i++){const x=7000+i*.17,z=-6000+i*.23;group.position.set(x,0,z);camera.position.set(x+14,height,z+20);camera.lookAt(x,0,z);counts.push(count());}
   results.push({height,min:Math.min(...counts),max:Math.max(...counts)});
  }
  const box=new T.Mesh(new T.BoxGeometry(20,8,20),new T.MeshBasicMaterial({color:0x19304b}));box.position.copy(group.position);box.position.y=4;scene.add(box);const occluded=count();return {results,occluded,centered};
 });console.log(result);await page.screenshot({path:"test-results/beam-base.png"});assert.ok(result.centered);assert.equal(result.occluded,0);for(const r of result.results){assert.ok(r.min>30);assert.ok((r.max-r.min)/r.min<.03,JSON.stringify(r));}assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
