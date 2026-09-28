import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1448,height:1086}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/?layoutSeed=1982');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,{},{timeout:120000});
 assert.equal(await page.evaluate(()=>__tron.state.dataBeams.length),1);
 assert.equal(await page.evaluate(()=>__tron.state.teleportPads.length),4);
 await page.goto('http://127.0.0.1:5173/?layoutSeed=1982&outerMazes=1');
 await page.waitForFunction(()=>window.__tron&&!document.querySelector('#start').disabled,{},{timeout:120000});
 assert.equal(await page.evaluate(()=>__tron.state.dataBeams.length),5);
 assert.equal(await page.evaluate(()=>__tron.state.teleportPads.length),20);
 await page.route('**/labyrinth-render',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:black"></body>'}));
 await page.goto('http://127.0.0.1:5173/labyrinth-render');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createScenario}=await import('/src/levels/scenario.js'),{createWorld}=await import('/src/rendering/world.js');
  const {world}=createScenario({layout:'blueprint',layoutSeed:1982,centralLabyrinth:true});
  const scene=new T.Scene();scene.background=new T.Color(0x010918);
  scene.add(new T.AmbientLight(0xffffff,3));const light=new T.DirectionalLight(0x9bcaff,4);light.position.set(-400,1500,700);scene.add(light);
  const rendered=createWorld(scene,world);
  const {MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const shadows=new MazeShadows(rendered,[],world);
  const renderer=new T.WebGLRenderer({antialias:true,stencil:true});renderer.setSize(1448,1086);document.body.append(renderer.domElement);
  window.renderWall=()=>{
   const p=shadows.wallShadow.geometry.attributes.position;
   let best=null;
   for(let i=0;i<p.count;i+=3){
    const [a,b,c]=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));
    const cross=b.clone().sub(a).cross(c.clone().sub(a)),area=cross.length(),normal=cross.clone().normalize(),center=a.clone().add(b).add(c).multiplyScalar(1/3);
    const m=world.MAZE_INSTANCES[4];
    if(Math.abs(normal.y)<.1&&center.x>m.bounds.minX&&center.x<m.bounds.maxX&&-center.z>m.bounds.minS&&-center.z<m.bounds.maxS&&(!best||area>best.area))best={area,normal,center:a.clone().add(b).multiplyScalar(.5)};
   }
   const camera=new T.PerspectiveCamera(60,1448/1086,.15,12000);
   camera.position.copy(best.center).addScaledVector(best.normal,8);camera.lookAt(best.center);renderer.render(scene,camera);
  };
  window.renderMaze=(overview=false,angled=false)=>{
   const m=world.MAZE_INSTANCES[4],width=overview?10300:3800,aspect=1448/1086;
   const camera=new T.OrthographicCamera(-width/2,width/2,width/aspect/2,-width/aspect/2,.1,20000);
   camera.up.set(0,0,-1);camera.position.set(m.x,angled?3300:8000,-m.s+(angled?1800:0));camera.lookAt(m.x,0,-m.s);
   renderer.render(scene,camera);
  };window.renderMaze();
 });
 await page.screenshot({path:'test-results/labyrinth-top.png'});
 await page.evaluate(()=>renderMaze(false,true));await page.screenshot({path:'test-results/labyrinth-3d.png'});
 await page.evaluate(()=>renderMaze(true));await page.screenshot({path:'test-results/five-mazes.png'});
 await page.evaluate(()=>renderWall());await page.screenshot({path:'test-results/labyrinth-wall-shadow.png'});
 assert.deepEqual(errors,[]);console.log('Five-maze game startup, beams/pads, and traced 3D labyrinth rendering passed.');
}finally{await browser.close();}
