import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/horizon-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5174/horizon-test');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Horizon}=await import('/src/rendering/horizon.js');const scene=new T.Scene(),sky=new Horizon(scene),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(63,1.5,.15,12000),dir=sky.material.uniforms.direction.value;
  const gl=renderer.getContext(),data=new Uint8Array(1200*800*4);
  function draw(sign,offset=0){camera.position.set(offset,5,offset);camera.lookAt(camera.position.clone().addScaledVector(dir,sign));sky.update(camera,true);renderer.render(scene,camera);gl.readPixels(0,0,1200,800,gl.RGBA,gl.UNSIGNED_BYTE,data);let horizon=0,zenith=0;for(let y=405;y<450;y++)for(let x=300;x<900;x++)horizon+=data[(y*1200+x)*4+2];for(let y=700;y<750;y++)for(let x=300;x<900;x++)zenith+=data[(y*1200+x)*4+2];return {horizon:horizon/(45*600),zenith:zenith/(50*600)};}
  const front=draw(1),translated=draw(1,6000),back=draw(-1);draw(1);return {front,translated,back};
 });assert.ok(result.front.horizon>result.back.horizon+30);assert.ok(result.front.horizon>result.front.zenith+30);assert.ok(Math.abs(result.front.horizon-result.translated.horizon)<1);assert.deepEqual(errors,[]);await page.screenshot({path:'test-results/horizon-gradient.png'});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.press('Escape');await page.screenshot({path:'test-results/horizon-game.png'});assert.deepEqual(errors,[]);console.log(result);
}finally{await browser.close();}
