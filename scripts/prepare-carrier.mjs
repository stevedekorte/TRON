// Run against npm run dev. Converts the untouched DAE through Three.js in Chrome.
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/carrier-conversion',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
  await page.goto('http://127.0.0.1:5173/carrier-conversion');
  const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {ColladaLoader}=await import('/node_modules/three/examples/jsm/loaders/ColladaLoader.js');
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const base='/docs/models/TRON%20CARRIER%20DAE/';
    const manager=new T.LoadingManager();
    const failures=[];manager.onError=url=>failures.push(url);
    manager.setURLModifier(url=>url.includes('file://')?base+url.slice(url.indexOf('file://')+7):url);
    const loaded=new Promise(resolve=>manager.onLoad=resolve);
    const model=await new ColladaLoader(manager).loadAsync(base+'TRON_CARRIER.dae');
    await loaded;
    if(failures.length)throw new Error('Missing textures: '+failures.join(', '));
    model.scene.updateMatrixWorld(true);
    let meshes=0,triangles=0;const textures=new Set();
    model.scene.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
      for(const m of [].concat(o.material))if(m.map)textures.add(m.map.uuid);
    });
    const size=new T.Box3().setFromObject(model.scene).getSize(new T.Vector3()).toArray();
    const binary=await new GLTFExporter().parseAsync(model.scene,{binary:true});
    const bytes=new Uint8Array(binary);let str='';
    for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {base64:btoa(str),meshes,triangles,textures:textures.size,size};
  });
  const {base64,...stats}=result;
  await writeFile('docs/models/tron_1982_carrier.glb',Buffer.from(base64,'base64'));
  await page.goto('http://127.0.0.1:5173/carrier.html');
  await page.waitForFunction(()=>window.carrierReady===true);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/carrier-preview.png'});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify(stats,null,2));
} finally {await browser.close();}
