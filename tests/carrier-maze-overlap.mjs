import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/overlap-test',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
 await page.goto('http://127.0.0.1:5173/overlap-test');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const scene=new T.Scene(),floor=new T.Mesh(new T.PlaneGeometry(600,600),new T.MeshBasicMaterial({color:0x6688aa}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.renderOrder=-2;scene.add(floor);
  const slabs=new T.Mesh(new T.BoxGeometry(130,70,130),new T.MeshBasicMaterial());slabs.position.set(0,35,0);slabs.rotation.y=.27;scene.add(slabs);
  const seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(seams);
  const maze=new MazeShadows({floor,slabs,seams},[],{MAZE_INSTANCES:[{x:0,s:0}],MAZE_LENGTH:700,WALL_HEIGHT:70});
  const root=new T.Group(),caster=new T.Mesh(new T.BoxGeometry(300,20,300));root.add(caster);root.position.set(-40,150,-40);
  const moving=new RecognizerShadows([{root,casters:[caster],radius:400,distance:800}],[floor],0,{size:512,prefix:'carrierShadow',darkness:.5,filterEdges:'soft'});
  const renderer=new T.WebGLRenderer({stencil:true});renderer.setSize(700,500);document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(55,1.4,.1,2000);camera.position.set(220,65,280);camera.lookAt(20,0,20);
  const target=new T.WebGLRenderTarget(700,500,{stencilBuffer:true});
  maze.update(renderer);moving.update(renderer);slabs.visible=false;maze.wallShadow.visible=false;
  const pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(700*500*4);renderer.readRenderTargetPixels(target,0,0,700,500,p);return p;};
  const reference=pixels();moving.setOcclusion(maze);const fixed=pixels();
  floor.userData.exactMazeFloorShadow=false;moving.setOcclusion(maze);const old=pixels();
  let fixedDifferences=0,oldDifferences=0;for(let i=0;i<reference.length;i++){if(reference[i]!==fixed[i])fixedDifferences++;if(reference[i]!==old[i])oldDifferences++;}
  floor.userData.exactMazeFloorShadow=true;moving.setOcclusion(maze);renderer.setRenderTarget(null);renderer.render(scene,camera);
  return {fixedDifferences,oldDifferences};
 });
 assert.equal(result.fixedDifferences,0);assert(result.oldDifferences>1000,JSON.stringify(result));assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/carrier-maze-overlap.png'});console.log(result);
}finally{await browser.close();}
