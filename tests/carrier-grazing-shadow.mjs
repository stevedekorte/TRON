import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/grazing-shadow-test',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/grazing-shadow-test');
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {RecognizerShadows}=await import('/src/rendering/recognizer-shadows.js');
  const {MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const renderer=new T.WebGLRenderer({antialias:true,stencil:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  const target=new T.WebGLRenderTarget(400,280),result=[];
  for(const offset of [0,7000])for(const angle of [-Math.PI/4,-Math.PI/4-.2]){
   const scene=new T.Scene(),geo=new T.PlaneGeometry(160,70,24,8).toNonIndexed();geo.rotateY(angle);geo.translate(offset,35,-offset);
   geo.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1),1));geo.computeVertexNormals();geo.setAttribute('shadowReceiverNormal',geo.attributes.normal.clone());
   const slabs=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x8899aa,side:T.DoubleSide}));scene.add(slabs);
   const floor=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial()),seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(floor,seams);
   const map={MAZE_INSTANCES:[{x:offset,s:offset}],MAZE_LENGTH:400,WALL_HEIGHT:70};
   const maze=new MazeShadows({slabs,floor,seams},[],map);maze.update(renderer);maze.floorShadow.visible=maze.wallShadow.visible=false;
   const root=new T.Group(),caster=new T.Mesh(new T.BoxGeometry(500,10,500));root.add(caster);root.position.set(offset,150,-offset);root.updateMatrixWorld(true);
   const carrier=new RecognizerShadows([{root,casters:[caster],radius:400,distance:800}],[slabs],0,{prefix:'testCarrier',size:512,darkness:.65,filterEdges:'soft'});carrier.update(renderer);
   const camera=new T.PerspectiveCamera(55,400/280,.1,2000);camera.position.set(offset-100,35,-offset+100);camera.lookAt(offset,35,-offset);
   const pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(400*280*4);renderer.readRenderTargetPixels(target,0,0,400,280,p);renderer.setRenderTarget(null);return p;};
   carrier.strengths.fill(0);const baseline=pixels();carrier.strengths.fill(1);const unmasked=pixels();carrier.setOcclusion(maze);const masked=pixels();
   let covered=0,patches=0;for(let i=0;i<baseline.length;i+=4){if(baseline[i]>unmasked[i]+5)covered++;if(baseline[i]>masked[i]+5)patches++;}
   renderer.render(scene,camera);result.push({offset,angle,covered,patches});carrier.dispose();maze.dispose();
  }
  return result;
 });
 assert(results.every(r=>r.covered>1000&&(r.angle===-Math.PI/4?r.patches===0:r.patches>1000)),JSON.stringify(results));assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/carrier-grazing-wall.png'});console.log(results);
}finally{await browser.close();}
