// One explicit paid submission, then resumable read-only polling/downloads.
// Usage: node scripts/generate-meshy-shuttle.mjs submit | status | download
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const detail=process.argv.includes('--detail');
const isolated=process.argv.includes('--isolated');
const out=new URL(`../docs/models/carrier-shuttle/${detail?'meshy-detail':isolated?'meshy-isolated':'meshy'}/`,import.meta.url);
const endpoint='https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const command=process.argv[2];
if(!['submit','status','download'].includes(command))throw Error('Choose submit, status or download.');
const key=(await readFile(new URL('../credentials/Meshy.txt',import.meta.url),'utf8')).trim();
if(!key||key.startsWith('\0GITCRYPT'))throw Error('Meshy credential is empty or locked.');
await mkdir(out,{recursive:true});
const taskFile=new URL('task.json',out);
async function api(url,body){
 const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error(`Meshy HTTP ${response.status}; request not automatically retried.`);
 return response.json();
}
if(command==='submit'){
 try{await access(taskFile);throw Error('A task already exists. Inspect it before creating another paid task.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const refs=detail?['detachment-crop.png']:isolated?['Escapepodside.webp','detachment-crop.png']:['Escapepodside.webp','Escapepodtop.webp','Escapepodback.webp','Escapepoddetach.webp'];
 const inputs=[];
 for(const [i,name] of refs.entries()){
  const source=new URL(name==='detachment-crop.png'?'../docs/models/carrier-shuttle/detachment-crop.png':`../docs/references/images/Carrier Escape Pod/${name}`,import.meta.url);
  const target=new URL(`reference-${i+1}.png`,out);
  execFileSync('sips',['-s','format','png',fileURLToPath(source),'--out',fileURLToPath(target)],{stdio:'ignore'});
  const data=await readFile(target);inputs.push({source:name,sha256:createHash('sha256').update(data).digest('hex'),url:`data:image/png;base64,${data.toString('base64')}`});
 }
 const settings={ai_model:'meshy-7.1',geometry_resolution:'2k',should_texture:true,texture_resolution:'2k',enable_pbr:true,should_remesh:true,topology:'triangle',target_polycount:30000,save_pre_remeshed_model:true,image_enhancement:false,target_formats:['glb'],multi_view_thumbnails:true};
 const result=await api(endpoint,{...settings,image_urls:inputs.map(i=>i.url)});
 if(typeof result.result!=='string')throw Error('Meshy returned no task ID; inspect the account before retrying.');
 await writeFile(taskFile,JSON.stringify({id:result.result,createdAt:new Date().toISOString(),settings,references:inputs.map(({url,...info})=>info)},null,2)+'\n');
 console.log(`Submitted Meshy task ${result.result}`);
}else{
 const task=JSON.parse(await readFile(taskFile,'utf8'));
 const result=await api(`${endpoint}/${encodeURIComponent(task.id)}`);
 console.log(JSON.stringify({id:task.id,status:result.status,progress:result.progress,credits:result.consumed_credits}));
 if(command==='download'){
  if(result.status!=='SUCCEEDED')throw Error('Task has not succeeded yet.');
  const files={'shuttle.glb':result.model_urls?.glb,'shuttle-original.glb':result.model_urls?.pre_remeshed_glb,'preview.png':result.thumbnail_url};
  for(const [view,url] of Object.entries(result.thumbnail_urls||{}))if(['front','right','back','left'].includes(view))files[`preview-${view}.png`]=url;
  for(const [name,url] of Object.entries(files)){
   if(!url)continue;
   const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error(`Asset download HTTP ${response.status}`);
   await writeFile(new URL(name,out),new Uint8Array(await response.arrayBuffer()));
   console.log(`Saved ${name}`);
  }
  await writeFile(taskFile,JSON.stringify({...task,status:result.status,consumedCredits:result.consumed_credits,downloadedAt:new Date().toISOString()},null,2)+'\n');
 }
}
