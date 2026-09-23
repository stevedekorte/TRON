import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/carrier-rez-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/carrier-rez-fixture');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadCarrier,updateCarrier}=await import('/src/rendering/carrier.js');const{CarrierMaterialization}=await import('/src/rendering/carrier-materialization.js');
  const{CARRIER}=await import('/src/game/carrier.js');const{MATERIALIZATION}=await import('/src/game/materialization.js');
  const scene=new T.Scene(),ship=await loadCarrier();ship.position.set(0,0,0);scene.background=new T.Color(0x03050c);scene.fog=new T.FogExp2(0x090d1d,.0024);
  scene.add(ship,new T.HemisphereLight(0xaac8ff,0x251829,2));const light=new T.DirectionalLight(0xc4d9ff,2.4);light.position.set(-35,70,-35);scene.add(light);
  const rez=new CarrierMaterialization(ship),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,900);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(50,1280/900,1,10000);camera.position.set(900,550,1000);camera.lookAt(0,0,0);
  const endTime=(rez.bounds.max.z-rez.bounds.min.z+2*MATERIALIZATION.sweepClearance)/CARRIER.speed+MATERIALIZATION.openSeconds;
  window.fixture={renderer,scene,camera,rez,ship,updateCarrier,speed:CARRIER.speed,endTime,fade:CARRIER.materializationFadeSeconds};
 });
 const samples=[];
 const times=await page.evaluate(()=>[0,1,fixture.endTime/2,fixture.endTime+fixture.fade/2,fixture.endTime+fixture.fade+1,0]);
 for(const time of times){
  samples.push(await page.evaluate(time=>{const f=window.fixture;f.ship.position.x=f.speed*time;f.camera.position.set(f.ship.position.x+900,550,1000);f.camera.lookAt(f.ship.position.x,0,0);f.rez.updateTransit(time,f.speed);f.renderer.render(f.scene,f.camera);return {opacity:f.rez.opacity,rectangle:f.rez.rectangle.visible,scan:f.rez.rectangle.position.toArray(),worldScan:f.rez.rectangle.getWorldPosition(f.rez.rectangle.position.clone()).toArray(),
   frontVisible:f.rez.bounds.min.z<=f.rez.wire.rezCut.value,rearVisible:f.rez.bounds.max.z<=f.rez.wire.rezCut.value,span:f.rez.bounds.getSize(f.rez.rectangle.position.clone()).toArray()};},time));
  if(time===times[2]){
   const check=await page.evaluate(()=>{
    const f=fixture,gl=f.renderer.getContext(),pixels=new Uint8Array(1280*900*4);
    f.renderer.render(f.scene,f.camera);gl.readPixels(0,0,1280,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i]>pixels[i+1]*2&&pixels[i]>pixels[i+2]*2)red++;
    const position=f.ship.position.clone();
    f.updateCarrier(f.ship,.1);const bright=f.ship.userData.beacons[0].material.emissiveIntensity;
    f.updateCarrier(f.ship,.7);const dim=f.ship.userData.beacons[0].material.emissiveIntensity;f.ship.position.copy(position);
    return {red,bright,dim,fog:f.rez.lineMaterial.fog,live:f.rez.materials.filter(m=>m.live).length,cut:f.rez.live.rezCut.value,wireCut:f.rez.wire.rezCut.value};
   });
   assert(check.red>100,'wireframe remains bright red in distant ground fog');assert.equal(check.fog,false);assert(check.live>0);assert.equal(check.cut,check.wireCut);assert(check.bright>check.dim+1,'beacons keep blinking during wireframe phase');console.log(check);
  }
  await page.screenshot({path:`test-results/carrier-rez-${time}.png`});
 }
 const pulse=await page.evaluate(()=>{
  const f=fixture,values=[];for(const t of [10,10+1/28,10+1/14,10+3/28,10+1/7]){f.rez.updateTransit(t,f.speed);values.push(f.rez.rectangle.material.uniforms.panelPulse.value);}return values;
 });
 assert(Math.max(...pulse)-Math.min(...pulse)>.2);assert(pulse.every(v=>v>=.78-1e-8&&v<=1));assert(Math.abs(pulse[0]-pulse[4])<1e-8);
 assert.equal(samples[0].opacity,0);assert.equal(samples[2].opacity,0);assert(samples[3].opacity>0&&samples[3].opacity<1);assert.equal(samples[4].opacity,1);assert.equal(samples[4].rectangle,false);
 assert(samples[2].span[2]>1000,'sweep follows hull length');assert(samples[1].scan[0]>samples[2].scan[0]);
 for(const sample of samples.slice(0,4))assert(sample.worldScan.every((v,i)=>Math.abs(v-samples[0].worldScan[i])<1e-7),'rectangle stays fixed in world coordinates');
 assert(samples[2].frontVisible&&!samples[2].rearVisible,'bow emerges before stern');assert.deepEqual(samples[0],samples[5]);assert.deepEqual(errors,[]);console.log(samples);
}finally{await browser.close()}
