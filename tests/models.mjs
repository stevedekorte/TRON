import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.route('**/model-inspection',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#03050c"></body>'}));
  await page.goto('http://127.0.0.1:5173/model-inspection');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {createTank,loadRecognizer,createRecognizer}=await import('/src/rendering/models.js');
    const {RECOGNIZER_SCALE}=await import('/src/game/config.js');
    const {CRUSH}=await import('/src/simulation/crush.js');
    const {cannonPose}=await import('/src/simulation/run.js');
    const tank=await createTank(), template=await loadRecognizer();
    const craft=createRecognizer(template), other=createRecognizer(template);
    const scene=new T.Scene();scene.background=new T.Color(0x03050c);
    const errors=[];
    for(const yaw of [0,.8,-1.5])for(const turretYaw of [0,.6,-2]){
      tank.root.position.set(12,0,-17);tank.root.rotation.y=yaw;tank.turret.rotation.y=turretYaw;
      tank.root.updateMatrixWorld(true);
      const visual=tank.flash.getWorldPosition(new T.Vector3()),sim=cannonPose({x:12,s:17,yaw,turretYaw});
      errors.push(visual.distanceTo(new T.Vector3(sim.x,sim.y,-sim.s)));
    }
    tank.root.position.set(-5,0,0);tank.root.rotation.y=.15;tank.turret.rotation.y=.25;
    scene.add(tank.root);craft.root.scale.setScalar(RECOGNIZER_SCALE);craft.root.position.set(10,CRUSH.soleHeight,-8);scene.add(craft.root);
    const b=new T.Box3().setFromObject(craft.root);
    scene.add(new T.HemisphereLight(0xaac8ff,0x251829,2));
    const light=new T.DirectionalLight(0xc4d9ff,2.4);light.position.set(-35,70,35);scene.add(light);
    const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x152640,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;scene.add(floor);
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;document.body.append(renderer.domElement);
    const camera=new T.PerspectiveCamera(48,1400/900,.1,500);camera.position.set(-22,15,-32);camera.lookAt(1,5,-3);
    renderer.render(scene,camera);
    window.inspection={craft,renderer,scene,camera};
    return {muzzleError:Math.max(...errors),feetY:b.min.y,height:b.max.y-b.min.y,width:b.max.x-b.min.x,independentMaterials:craft.material!==other.material,meshes:tank.root.children.length,source:tank.source};
  });
  assert.ok(result.muzzleError<1e-10);assert.ok(Math.abs(result.height-19.5)<1e-5);
  assert.ok(Math.abs(result.feetY)<.001);assert.ok(result.independentMaterials);assert.equal(result.source,'arabinowitz');
  await page.screenshot({path:'test-results/imported-models.png'});
  for(const fold of [.5,1]) {
    await page.evaluate(f=>{const {craft,renderer,scene,camera}=window.inspection;craft.pose(f);renderer.render(scene,camera);},fold);
    await page.screenshot({path:'test-results/recognizer-fold-'+fold+'.png'});
  }
  assert.deepEqual(errors,[]);console.log(result);
} finally {await browser.close();}
