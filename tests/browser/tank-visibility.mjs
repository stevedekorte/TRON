import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:700}});
 await page.route('**/tank-inspection',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5174/tank-inspection');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createTank,cloneEnemyTank}=await import('/src/rendering/models.js');
  const tank=await createTank(),enemy=cloneEnemyTank(tank),scene=new T.Scene();scene.background=new T.Color(0x03050c);
  scene.add(new T.HemisphereLight(0xaac8ff,0x251829,2));const light=new T.DirectionalLight(0xc4d9ff,2.4);light.position.set(-35,70,-35);scene.add(light);
  scene.add(enemy.root);const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshBasicMaterial({color:0x152b46}));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;scene.add(floor);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,700);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
  document.body.replaceChildren(renderer.domElement);const camera=new T.PerspectiveCamera(48,1200/700,.1,1000);camera.position.set(12,3,-22);camera.lookAt(0,1.5,0);renderer.render(scene,camera);
  let enemyTrim;enemy.root.traverse(o=>{if(o.material?.name==='Wheels_Red_Emission')enemyTrim=o.material;});
  window.inspection={T,tank,enemy,scene,camera,renderer};return {isolated:tank.turboTrim.every(m=>m!==enemyTrim),trimCount:tank.turboTrim.length};
 });assert.ok(result.isolated&&result.trimCount>0);
 await page.screenshot({path:'test-results/enemy-tank-low-angle.png'});
 await page.evaluate(()=>{const {tank,enemy,scene,camera,renderer}=window.inspection;scene.remove(enemy.root);scene.add(tank.root);camera.position.set(12,5,18);camera.lookAt(0,1.5,0);tank.turboTrim.forEach(m=>{m.emissive.setHex(0xff0301);m.emissiveIntensity=2.4;});renderer.render(scene,camera);});
 await page.screenshot({path:'test-results/tank-turbo-trim.png'});
 await page.goto('http://127.0.0.1:5174');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__tron.state.mode==='running');await page.keyboard.up('KeyW');
 await page.evaluate(()=>__tron.place({x:-5000,s:-5000,recognizers:[],enemyTanks:[]}));
 await page.keyboard.press('KeyT');await page.waitForFunction(()=>__tron.state.weaponVisual.turboTrimIntensity>1);
 const a=await page.evaluate(()=>__tron.state.weaponVisual.turboTrimIntensity);await page.waitForTimeout(175);const b=await page.evaluate(()=>__tron.state.weaponVisual.turboTrimIntensity);assert.ok(Math.abs(a-b)>.01);
 await page.evaluate(()=>__tron.place({turboRemaining:0}));await page.waitForFunction(()=>__tron.state.weaponVisual.turboTrimIntensity<.01);
 console.log({...result,pulse:true,returnsToNormal:true});
}finally{await browser.close();}
