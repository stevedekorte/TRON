import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/shadow-union-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));await page.goto('http://127.0.0.1:5173/shadow-union-fixture');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{mergeGeometries}=await import('/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');
  const {MazeShadows}=await import('/src/rendering/maze-shadows.js'),{CarrierShadows}=await import('/src/rendering/carrier-shadows.js');
  const scene=new T.Scene(),plane=new T.PlaneGeometry(150,100).translate(0,50,0),block=new T.BoxGeometry(50,30,10).translate(-25,80,-30);
  for(const [g,id] of [[plane,1],[block,2]])g.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(id),1));
  const slabs=new T.Mesh(mergeGeometries([plane.toNonIndexed(),block.toNonIndexed()]),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,toneMapped:false}));scene.add(slabs);
  const floor=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial()),seams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());scene.add(floor,seams);
  const world={slabs,floor,seams},maze=new MazeShadows(world,[],{MAZE_INSTANCES:[{x:0,s:0}],MAZE_LENGTH:400,WALL_HEIGHT:100});
  const root=new T.Group(),hull=new T.Mesh(new T.BoxGeometry(900,20,900),new T.MeshBasicMaterial());hull.material.name='TxTC01';root.add(hull);root.position.set(0,300,-100);
  const carrier=new CarrierShadows(root,world,[]);carrier.setOcclusion(maze);
  const renderer=new T.WebGLRenderer({stencil:true});renderer.setSize(1000,700);document.body.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-70,70,95,-5,.1,1000);camera.position.set(0,0,200);camera.lookAt(0,0,0);
  const target=new T.WebGLRenderTarget(400,280,{stencilBuffer:true});
  maze.update(renderer);carrier.update(renderer);maze.floorShadow.visible=false;
  const pixels=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(400*280*4);renderer.readRenderTargetPixels(target,0,0,400,280,p);renderer.setRenderTarget(null);return p;};
  carrier.strengths.fill(0);const staticOnly=pixels();carrier.strengths.fill(1);maze.wallShadow.visible=false;const movingOnly=pixels();maze.wallShadow.visible=true;const together=pixels();
  let staticPixels=0,wrong=0;for(let y=25;y<255;y++)for(let x=25;x<375;x++){const i=(y*400+x)*4;if(staticOnly[i]<200)staticPixels++;if(Math.abs(together[i]-Math.min(staticOnly[i],movingOnly[i]))>3)wrong++;}
  renderer.render(scene,camera);return {staticPixels,wrong};
 });assert(result.staticPixels>1000,JSON.stringify(result));assert.equal(result.wrong,0,JSON.stringify(result));assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/carrier-shadow-union.png'});console.log(result);
}finally{await browser.close();}
