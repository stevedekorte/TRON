import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/jev/**',r=>r.fulfill({status:503,body:'test'}));
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,null,{timeout:120000});
 const roster=await page.evaluate(()=>({tanks:__tron.state.enemyTanks,bosses:__tron.state.enemyTanks.filter(e=>e.boss),visuals:__tron.state.enemyTankVisuals.length}));
 assert.equal(roster.bosses.length,4);assert.equal(roster.bosses[0].health,12);assert.equal(roster.visuals,roster.tanks.length);
 await page.locator('#start').click();
 await page.waitForFunction(()=>['entering','running'].includes(__tron.state.mode),null,{timeout:60000});
 assert.deepEqual(errors,[]);
 // Isolated, reproducible view of the actual in-game adapter.
 await page.goto('http://localhost:5173/update.html');
 const dimensions=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createBossTank}=await import('/src/rendering/boss-tank.js');
  const {BOSS_TANK,bossMuzzlePoses}=await import('/src/game/boss-tank.js');
  const craft=await createBossTank();document.body.innerHTML='';
  const scene=new T.Scene();scene.background=new T.Color('#18222e');scene.add(craft.root);
  scene.add(new T.HemisphereLight(0xffffff,0x668899,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(5,10,8);scene.add(light);
  const camera=new T.PerspectiveCamera(40,1.25,.1,100);camera.position.set(11,10,-17);camera.lookAt(0,1,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,800);document.body.append(renderer.domElement);
  craft.turret.rotation.y=.3;craft.root.updateMatrixWorld(true);
  const flashes=craft.flash.children.map(o=>o.getWorldPosition(new T.Vector3()).toArray());
  const muzzles=bossMuzzlePoses({x:0,s:0,yaw:0,turretYaw:.3});
  const error=Math.max(...flashes.map((v,i)=>Math.hypot(v[0]-muzzles[i].x,v[1]-muzzles[i].y,v[2]+muzzles[i].s)));
  craft.turret.rotation.y=0;renderer.render(scene,camera);
  return {error,flashes:flashes.length,width:new T.Box3().setFromObject(craft.root).getSize(new T.Vector3()).x};
 });
 assert.equal(dimensions.flashes,2);assert(dimensions.error<1e-8);assert(Math.abs(dimensions.width-6.5)<.001);
 await page.screenshot({path:'test-results/boss-tank.png'});
 console.log('Boss tank: startup, roster, paired muzzle alignment and rendered adapter passed.');
}finally{await browser.close();}
