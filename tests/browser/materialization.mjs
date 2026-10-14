import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'}),errors=[];
 await page.addInitScript(()=>localStorage.setItem('tron-enemy-ai',JSON.stringify({version:3,mode:'classic',small:false})));
 page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/rez-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:black"></body>'}));
 await page.goto(new URL('/rez-fixture',process.env.TRON_URL||'http://127.0.0.1:5173').href);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{loadRecognizer,createRecognizer}=await import('/src/rendering/models.js'),{Materialization}=await import('/src/rendering/materialization.js');
  const scene=new T.Scene(),craft=createRecognizer(await loadRecognizer());scene.add(craft.root);craft.root.position.set(0,25,0);craft.root.rotation.y=.35;
  const effect=new Materialization(craft.root);scene.add(new T.HemisphereLight(0xaac8ff,0x251829,3));const light=new T.DirectionalLight(0xc4d9ff,3);light.position.set(-35,70,35);scene.add(light);
  const camera=new T.PerspectiveCamera(45,1000/700,.1,1000);camera.position.set(42,32,65);camera.lookAt(0,17,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  window.rezFixture={scene,craft,effect,camera,renderer};
 });
 const phases=[];
 for(const age of [0,.3,1.5,2.4,2.575,2.8]){
  phases.push(await page.evaluate(age=>{const f=rezFixture;f.effect.update(age);f.renderer.render(f.scene,f.camera);const gl=f.renderer.getContext(),p=new Uint8Array(1000*700*4);gl.readPixels(0,0,1000,700,gl.RGBA,gl.UNSIGNED_BYTE,p);let red=0,solid=0,blueEnergy=0;for(let i=0;i<p.length;i+=4){if(p[i]>100&&p[i]>p[i+1]*2)red++;if(p[i+2]>20&&p[i+2]>p[i]*1.3)solid++;blueEnergy+=p[i+2];}return {age,red,solid,blueEnergy};},age));
  await page.screenshot({path:`test-results/materialization-${age}.png`});
 }
 assert.ok(phases[3].red>200);assert.equal(phases[3].solid,0);assert.ok(phases[4].solid>100);assert.ok(phases[5].blueEnergy>phases[4].blueEnergy);assert.deepEqual(errors,[]);console.log(phases);
 // Exercise the live game's growing render/audio/shadow lists and reset reuse.
 await page.goto(process.env.TRON_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');
 const initial=await page.evaluate(()=>__tron.state.recognizers.length);
 for(let n=1;n<=2;n++){
  await page.evaluate(()=>{const r=__tron.state;for(const [i,e] of r.recognizers.entries())Object.assign(e,{x:-5000+i*80,s:-5000,y:85,yaw:0,stompDisabled:true,canSee:true,state:'pursue',nextSense:Infinity,memory:{x:-5000,s:-4900,vx:0,vs:22,seenAt:r.time,source:e.id}});__tron.place({x:-5000,s:-4900,speed:0,cruiseThrottle:false,enemyTanks:[],recognizers:r.recognizers,pursuitSeconds:19.98});});
  await page.waitForFunction(count=>__tron.state.recognizers.length===count,initial+n);
  await page.waitForFunction(count=>__tron.state.audioSources===count,initial+n);
 }
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>({time:__tron.state.time,start:__tron.state.recognizers.at(-1).rezStarted}));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__tron.state.time),paused.time);
 await page.evaluate(()=>{const r=__tron.state,e=r.recognizers.at(-1);Object.assign(e,{x:-5000,s:-4940,y:45,yaw:0,state:'materializing',rezStarted:r.time-2.575});__tron.place({x:-5000,s:-5000,yaw:0,recognizers:r.recognizers});});
 await page.screenshot({path:'test-results/materialization-game.png'});
 // More than twelve aircraft must not grow the dynamic shadow atlas indefinitely.
 await page.evaluate(()=>{const r=__tron.state,base=r.recognizers.at(-1);while(r.recognizers.length<15)r.recognizers.push({...base,id:2000+r.recognizers.length,x:-6000+r.recognizers.length*70,s:-4800,state:'investigate',rezStarted:undefined});__tron.place({recognizers:r.recognizers});});
 await page.waitForFunction(()=>__tron.state.audioSources===15);await page.screenshot({path:'test-results/materialization-many.png'});
 await page.evaluate(()=>__tron.reset());await page.waitForFunction(count=>__tron.state.recognizers.length===count,initial);
 assert.equal(await page.evaluate(()=>__tron.state.reinforcementsSpawned),0);assert.deepEqual(errors,[]);
 console.log('Two reinforcements, rendering/audio/shadows, pause and reset passed.');
}finally{await browser.close();}
