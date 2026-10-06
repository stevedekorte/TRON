import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/cycle-curve-preview',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/cycle-curve-preview');
 const count=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{loadLightCycles}=await import('/src/rendering/light-cycles.js'),{LightCycleWalls}=await import('/src/rendering/light-cycle-walls.js'),{LIGHT_CYCLES:C}=await import('/src/game/light-cycles.js');
  const models=await loadLightCycles(),scene=new T.Scene();scene.background=new T.Color(0x030709);scene.add(models[1]);scene.add(new T.HemisphereLight(0xc9eaff,0x202030,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,6,4);scene.add(light);
  const walls=new LightCycleWalls(scene);walls.update({phase:'racing',cycles:[{id:0,alive:true,segment:0,progress:1}],trails:[{bikeId:0,team:1,x1:0,z1:40/C.cellMeters,x2:0,z2:0}]},1);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(38,1.5,.1,100);camera.position.set(-6,2.2,3.4);camera.lookAt(0,.9,1.7);renderer.render(scene,camera);
  const {interpolateCycleRace}=await import('/src/rendering/cycle-poses.js');
  const race={phase:'racing',time:1,cycles:[{id:0,alive:true,continuousArena:true,segment:0,progress:1,dir:0,x:0,previousX:0,z:0,previousZ:.1666667,renderPrevious:{x:0,z:.1666667,dir:0},renderTravel:.1666667}],trails:[{bikeId:0,team:1,x1:0,z1:40/C.cellMeters,x2:0,z2:0}],crashes:[]};
  for(const alpha of [0,.9,.2,.8,.1,.5,1]){
   const r=interpolateCycleRace(race,alpha),z=r.cycles[0].z*C.cellMeters;
   models[1].position.z=z;walls.update(r,1);
   const matrix=new T.Matrix4();walls.meshes[1].getMatrixAt(0,matrix);
   const end=new T.Vector3(.5,0,0).applyMatrix4(matrix);
   if(Math.abs(end.z-z-C.lengthMeters*.347)>.00002)throw new Error('Wall curve shifted relative to bike');
   camera.position.set(-6,2.2,3.4+z);camera.lookAt(0,.9,1.7+z);renderer.render(scene,camera);
  }
  return walls.meshes[1].count;
 });
 assert.equal(count,17);await page.screenshot({path:'test-results/cycle-wall-curve.png'});assert.deepEqual(errors,[]);console.log('Rounded wall connection stays at the rear axle across irregular turbo-speed interpolation frames.');
}finally{await browser.close();}
