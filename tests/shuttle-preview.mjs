import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.TRON_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5174/shuttle.html');await page.waitForFunction(()=>window.shuttleReady);
 for(const view of ['reference','detach','side','top','rear','under']){await page.evaluate(v=>shuttle.setView(v),view);await page.waitForTimeout(300);await page.screenshot({path:`test-results/shuttle-${view}.png`});}
 const result=await page.evaluate(async()=>{
  const bytes=new Uint8Array(await shuttle.exportModel());let s='';for(const b of bytes)s+=String.fromCharCode(b);return {base64:btoa(s),triangles:shuttle.triangles};
 });
 const bytes=Buffer.from(result.base64,'base64');assert.equal(bytes.toString('ascii',0,4),'glTF');assert.ok(result.triangles<5000);
 await writeFile('docs/models/carrier-shuttle/carrier-escape-shuttle.glb',bytes);
 const checked=await page.evaluate(async()=>{
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
  const {scene}=await new GLTFLoader().loadAsync('/docs/models/carrier-shuttle/carrier-escape-shuttle.glb');
  return new Box3().setFromObject(scene).getSize(new Vector3()).toArray();
 });assert.ok(checked.every(v=>v>8&&v<25));assert.deepEqual(errors,[]);console.log({triangles:result.triangles,bytes:bytes.length,dimensions:checked,errors});
}finally{await browser.close();}
