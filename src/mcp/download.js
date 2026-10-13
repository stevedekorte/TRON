// Download the pinned component manifest before constructing GPU sessions.
// This gives an honest total and avoids Transformers.js's generic-model probes.
export async function prepareVoiceFiles({cache,baseURL,files,onProgress,fetchImpl=fetch,now=()=>performance.now()}){
 const url=file=>/^https?:\/\//.test(file)?file:baseURL+file;
 const totalBytes=Object.values(files).reduce((sum,n)=>sum+n,0),pending=[];
 let cachedBytes=0,downloadedBytes=0,started,lastReport=-Infinity,lastStage,lastComponent;
 const report=(stage,component)=>{
  const time=now();
  if(stage==='downloading'&&stage===lastStage&&component===lastComponent&&time-lastReport<100)return;
  lastReport=time;lastStage=stage;lastComponent=component;
  const seconds=started===undefined?0:(time-started)/1000;
  const remaining=Math.max(0,totalBytes-cachedBytes-downloadedBytes);
  const etaSeconds=seconds>=1&&downloadedBytes>0?remaining/(downloadedBytes/seconds):null;
  onProgress({stage,component,totalBytes,cachedBytes,downloadedBytes,etaSeconds});
 };
 report('checking','Saved voice files');
 for(const [file,size] of Object.entries(files)){
  const cachedSize=cache.size?await cache.size(url(file)):Number((await cache.match(url(file)))?.headers.get('content-length'));
  if(cachedSize===size)cachedBytes+=size;
  else pending.push([file,size]);
  report('checking','Saved voice files');
 }
 for(const [file,size] of pending){
  started??=now();report('downloading',file);
  const response=await fetchImpl(url(file));
  if(!response.ok)throw new Error(`VOICE DOWNLOAD FAILED (${response.status}) — RETRY TO RESUME`);
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.byteLength;downloadedBytes+=value.byteLength;report('downloading',file);}
  if(bytes!==size)throw new Error('VOICE DOWNLOAD INCOMPLETE — RETRY TO RESUME');
  const buffer=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  report('saving',file);
  await cache.put(url(file),new Response(buffer,{headers:{'content-length':String(bytes),'content-type':response.headers.get('content-type')||'application/octet-stream'}}));
 }
 report('initializing','Preparing GPU — download complete');
}
