export class McpVoice{
 constructor(onProgress){this.onProgress=onProgress;this.pending=new Map();this.nextId=0;this.ready=false;}
 get generating(){return [...this.pending.values()].some(p=>p.type==='generate');}
 async load(){
  if(this.ready)return;
  this.cancel();
  const started=performance.now();
  this.worker=new Worker(new URL('./voice.worker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{
   if(data.type==='progress'){this.onProgress(data);return;}
   if(data.timings){this.timings=data.timings;console.table(data.timings);}
   const pending=this.pending.get(data.id);if(!pending)return;this.pending.delete(data.id);clearTimeout(pending.timer);
   if(data.type==='error')pending.reject(new Error(data.message));else pending.resolve(data);
  };
  this.worker.onerror=()=>this.cancel(new Error('MCP VOICE WORKER FAILED'));
  const response=await fetch(new URL('audio/mcp-reference.wav',document.baseURI));
  if(!response.ok)throw new Error('MCP VOICE REFERENCE UNAVAILABLE');
  const context=new OfflineAudioContext(1,1,24000),buffer=await context.decodeAudioData(await response.arrayBuffer());
  const audio=new Float32Array(buffer.getChannelData(0));
  try{await this.request('load',{audio});this.ready=true;this.timings={...this.timings,totalMilliseconds:performance.now()-started};console.info('MCP voice initialization timings (ms)',this.timings);}catch(error){this.cancel(error);throw error;}
 }
 request(type,data={}){return new Promise((resolve,reject)=>{if(!this.worker)return reject(new Error('MCP VOICE IS NOT LOADED'));const id=++this.nextId;const timer=setTimeout(()=>this.cancel(new Error('MCP VOICE TIMED OUT — RETRY TO RESUME FROM CACHED FILES')),type==='load'?1800000:90000);this.pending.set(id,{resolve,reject,timer,type});this.worker.postMessage({id,type,...data});});}
 generate(text){return this.request('generate',{text});}
 cancel(error=new Error('Voice cancelled')){this.worker?.terminate();this.worker=null;this.ready=false;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
}
