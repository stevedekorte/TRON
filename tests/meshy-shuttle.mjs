import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://localhost:5173/shuttle.html?model=${process.argv[2]||'meshy'}`);
 await page.waitForFunction(()=>window.shuttleReady);
 for(const view of ['reference','detach','side','top','rear','under']){
  await page.evaluate(v=>shuttle.setView(v),view);await page.waitForTimeout(350);
  await page.screenshot({path:`test-results/meshy-shuttle-${view}.png`});
 }
 const result=await page.evaluate(async()=>({triangles:shuttle.triangles,exportBytes:(await shuttle.exportModel()).byteLength}));
 if(['meshy-clean','meshy-preserved','planar'].includes(process.argv[2])){
  const check=await page.evaluate(async()=>{
   let symmetric=true;
   shuttle.model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*100000)).join(',');
    const points=new Set(Array.from({length:p.count},(_,i)=>key(p.getX(i),p.getY(i),p.getZ(i))));
    for(let i=0;i<p.count;i++)if(!points.has(key(-p.getX(i),p.getY(i),p.getZ(i)))||!points.has(key(p.getX(i),-p.getY(i),p.getZ(i))))symmetric=false;
   });
   const bytes=new Uint8Array(await shuttle.exportModel());let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {symmetric,base64:btoa(data)};
  });if(process.argv[2]!=='planar')assert(check.symmetric);
  await mkdir(`docs/models/carrier-shuttle/${process.argv[2]}`,{recursive:true});
  await writeFile(`docs/models/carrier-shuttle/${process.argv[2]}/shuttle.glb`,Buffer.from(check.base64,'base64'));
 }
 assert(result.triangles>0&&result.triangles<5000000);assert(result.exportBytes>1000);assert.deepEqual(errors,[]);
 console.log(result);
}finally{await browser.close();}
