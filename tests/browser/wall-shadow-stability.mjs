import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:500,height:400}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/wall-stability',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await page.goto('http://127.0.0.1:5173/wall-stability');
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const{MazeShadows}=await import('/src/rendering/maze-shadows.js');
  const{createStaticWallShadowGeometry}=await import('/src/rendering/static-wall-shadows.js');
  const{DEFAULT_WORLD}=await import('/src/levels/scenario.js');
  const renderer=new T.WebGLRenderer({stencil:true,antialias:false});renderer.setSize(500,400);
  const target=new T.WebGLRenderTarget(500,400,{stencilBuffer:true}),results=[];
  const pixels=scene=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(500*400*4);renderer.readRenderTargetPixels(target,0,0,500,400,p);return p;};
  const camera=new T.PerspectiveCamera(65,500/400,.15,12000);
  for(const offset of [0,4000,10000])for(const angle of [0,.31,Math.PI/4]){
   const transform=new T.Matrix4().makeRotationY(angle);transform.setPosition(offset,0,-offset);
   const wall=new T.PlaneGeometry(160,100).translate(0,50,0).applyMatrix4(transform);
   const caster=new T.BoxGeometry(70,50,5).rotateZ(.45).translate(-20,80,-20).applyMatrix4(transform);
   for(const [g,id]of [[wall,1],[caster,2]])g.setAttribute('shadowWallId',new T.Float32BufferAttribute(new Array(g.attributes.position.count).fill(id),1));
   const scene=new T.Scene(),slabs=new T.Mesh(wall,new T.MeshBasicMaterial({color:0x8899aa,side:T.DoubleSide}));scene.add(slabs);
   const shadows=new MazeShadows({slabs},[],{...DEFAULT_WORLD,MAZE_INSTANCES:[{x:offset,s:offset}]});shadows.floorShadow.visible=false;
   shadows.wallShadow.geometry.dispose();shadows.wallShadow.geometry=createStaticWallShadowGeometry(slabs,caster);
   for(const x of [0,70,140])for(const jitter of [0,.01,.02]){
    camera.position.copy(new T.Vector3(x+jitter,35,25).applyMatrix4(transform));camera.lookAt(new T.Vector3(0,45,0).applyMatrix4(transform));
    shadows.wallShadow.visible=false;const bare=pixels(scene);shadows.wallShadow.visible=true;
    shadows.wallShadow.material.depthTest=false;const reference=pixels(scene);
    shadows.wallShadow.material.depthTest=true;const actual=pixels(scene);
    let errors=0,coverage=0;for(let i=0;i<actual.length;i+=4){if(Math.abs(actual[i]-reference[i])>5)errors++;if(bare[i]-reference[i]>5)coverage++;}
    results.push({offset,angle,x,jitter,errors,coverage});
   }
   shadows.dispose();slabs.geometry.dispose();slabs.material.dispose();caster.dispose();
  }
  target.dispose();renderer.dispose();return results;
 });
 console.log(JSON.stringify({worst:Math.max(...results.map(r=>r.errors)),failing:results.filter(r=>r.errors>20)},null,2));assert.deepEqual(errors,[]);
 assert(results.every(r=>r.coverage>100),'fixture must contain a visible shadow');
 if(!process.argv.includes('--measure'))assert(results.every(r=>r.errors<20),'wall shadow interior must not drop out under camera motion');
}finally{await browser.close();}
