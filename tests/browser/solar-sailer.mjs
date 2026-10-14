import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL || 'chrome',headless:true});
try {
 const page = await browser.newPage({viewport:{width:1280,height:900}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/solar-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto(new URL('/solar-fixture',process.env.TRON_URL || 'http://127.0.0.1:5173').href);
 const result = await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadSolarSailer,SolarSailer}=await import('/src/rendering/solar-sailer.js');
  const {SOLAR_SAILER:c,solarSailerDuration}=await import('/src/game/solar-sailer.js');
  const {DEFAULT_WORLD}=await import('/src/levels/scenario.js');
  const {disposeSceneResources}=await import('/src/rendering/scene-resources.js');
  const scene=new T.Scene();scene.background=new T.Color(0x03050c);
  scene.add(new T.HemisphereLight(0xaac8ff,0x251829,2));
  const key=new T.DirectionalLight(0xc4d9ff,2.4);key.position.set(-35,70,-35);scene.add(key);
  const sailer=new SolarSailer(await loadSolarSailer(),scene,DEFAULT_WORLD);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(50,1280/900,.1,30000);
  const time=c.firstPassSeconds+solarSailerDuration(c)/2;
  sailer.update(time);const p=sailer.ship.position.clone();
  camera.position.copy(p).add(new T.Vector3(240,-90,250));camera.lookAt(p);
  renderer.render(scene,camera);
  const resources=[];
  for(let i=0;i<3;i++){
   sailer.update(time+i*c.periodSeconds);renderer.render(scene,camera);resources.push({...renderer.info.memory});
  }
  const before=sailer.ship.position.toArray();sailer.update(time);const after=sailer.ship.position.toArray();
  sailer.update(0);const hiddenAtReset=!sailer.ship.visible;
  sailer.update(time,false);const hiddenPreview=!sailer.root.visible;
  const beamFades=[];
  for (const t of [0,c.firstPassSeconds-c.beamFadeInSeconds/2,time,c.firstPassSeconds+solarSailerDuration(c)+c.beamFadeOutSeconds/2,c.firstPassSeconds+solarSailerDuration(c)+c.beamFadeOutSeconds+1]) {
   sailer.update(t);beamFades.push({visible:sailer.beam.visible,opacity:sailer.beam.children[0].material.opacity});
  }
  sailer.update(time);
  const sails=[...sailer.materials].filter(m=>m.name.startsWith('Translucent sail'));
  {if(!sails.length||sails.some(m=>Math.abs(m.opacity-.48)>1e-9||m.depthWrite))throw new Error('Sail transparency lost during update');}
  sailer.update(c.firstPassSeconds+c.chargeAfterSeconds+c.chargeDurationSeconds);
  if(sails.some(m=>m.opacity!==1||!m.depthWrite))throw new Error('Full sails not opaque');
  if(!sailer.ship.getObjectByName('Beam coupling star'))throw new Error('Beam contact star missing');
  sailer.update(c.firstPassSeconds);if(sails.some(m=>m.opacity!==0))throw new Error('Sails did not fade out');
  sailer.update(time);
  renderer.render(scene,camera);
  window.fixture={renderer,scene,camera,disposeSceneResources};
  const beamSegments=sailer.beam.children.filter(m=>m.userData.radius===1).map(m=>({side:m.userData.side,from:m.position.x-m.scale.y/2,to:m.position.x+m.scale.y/2}));
  return {beamCenter:before[0]-DEFAULT_WORLD.SPAWN.x,beamFades,resources,before,after,hiddenAtReset,hiddenPreview,materials:sailer.materials.size,beamSegments,gap:sailer.beamGap,scale:c.scale,yaw:sailer.ship.rotation.y};
 });
 assert(result.before.every((v,i)=>Math.abs(v-result.after[i])<1e-8));assert(result.hiddenAtReset&&result.hiddenPreview);
 assert.deepEqual(result.beamFades.map(p=>p.visible),[false,true,true,true,false]);
 for (const i of [1,3]) assert(Math.abs(result.beamFades[i].opacity-0.5)<1e-8);
 assert.equal(result.yaw,Math.PI/2);
 assert(Math.abs(result.beamSegments[0].to-result.beamCenter-result.gap.min*result.scale)<1e-7);
 assert(Math.abs(result.beamSegments[1].from-result.beamCenter-result.gap.max*result.scale)<1e-7);
 assert(result.beamSegments[1].from>result.beamSegments[0].to);
 assert.deepEqual(result.resources[0],result.resources[2]);assert(result.resources[0].textures>=7);
 await page.screenshot({path:'test-results/solar-sailer-adapted.png'});
 const remaining=await page.evaluate(()=>{const f=window.fixture;f.disposeSceneResources(f.scene);f.renderer.render(f.scene,f.camera);return {...f.renderer.info.memory};});
 assert.equal(remaining.geometries,0);assert.equal(remaining.textures,1); // Renderer-owned DFG lighting LUT; all seven model textures released.assert.deepEqual(errors,[]);
 console.log({browser:await browser.version(),...result,remaining});
}finally{await browser.close();}
