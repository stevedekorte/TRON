// Isolate arena architecture from the user-supplied composite scene; run with Vite.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const output='docs/models/extra/tron_1982_light_cycle_arena.glb';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 await page.route('**/arena-extraction',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
 await page.goto('http://127.0.0.1:5173/arena-extraction');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const model=await new GLTFLoader().loadAsync('/docs/models/extra/tron_1982.glb');
  const included=new Set(['Arena','Arena_Break_Inside','Arena_Ground','Arena_light','Arena_graffiti_sark','SIGNS','hidden_wall_01']);
  const remove=[],materials=[];let meshes=0,triangles=0;
  model.scene.traverse(o=>{if(!o.isMesh)return;const names=[].concat(o.material).map(m=>m.name);
   if(!names.every(n=>included.has(n)))remove.push(o);else{materials.push(...names);meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}
  });
  remove.forEach(o=>o.removeFromParent());
  const arena=new T.Group();arena.name='Light_Cycle_Arena';arena.userData={sourceAsset:model.asset.extras,modifications:'Arena architecture only; original scale and materials preserved; centered horizontally and base placed at Y=0.'};arena.add(model.scene);
  arena.updateMatrixWorld(true);const before=new T.Box3().setFromObject(arena),center=before.getCenter(new T.Vector3());
  model.scene.position.sub(new T.Vector3(center.x,before.min.y,center.z));arena.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(arena),size=bounds.getSize(new T.Vector3());
  const binary=await new GLTFExporter().parseAsync(arena,{binary:true});
  // Reload the standalone bytes to verify the exported file and embedded textures.
  const reloaded=await new GLTFLoader().parseAsync(binary,'');
  const scene=new T.Scene();scene.background=new T.Color(0x151b28);scene.add(reloaded.scene);
  scene.add(new T.HemisphereLight(0xffffff,0x607080,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(size.x,size.x,size.z);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,1000);document.body.append(renderer.domElement);
  const span=Math.max(size.x,size.z),camera=new T.PerspectiveCamera(42,1.4,span/10000,span*10);
  camera.position.set(span*.8,span*.95,span*.85);camera.lookAt(0,size.y*.3,0);renderer.render(scene,camera);
  const bytes=new Uint8Array(binary);let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {base64:btoa(str),meshes,triangles,materials,size:size.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
 });
 const {base64,...stats}=result;await writeFile(output,Buffer.from(base64,'base64'));
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'docs/models/extra/tron_1982_light_cycle_arena-preview.png'});
 console.log(JSON.stringify({output,...stats},null,2));
}finally{await browser.close();}
