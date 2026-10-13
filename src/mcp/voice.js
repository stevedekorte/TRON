export class McpVoice{
 constructor(onProgress){this.onProgress=onProgress;this.pending=new Set();this.ready=false;this.base=(import.meta.env.VITE_MCP_API_BASE||import.meta.env.VITE_JEV_API_BASE||'').replace(/\/$/,'');}
 get generating(){return this.pending.size>0;}
 async load(){
  const response=await fetch(this.base+'/api/mcp/voice-status',{signal:AbortSignal.timeout(10000)});
  const info=await response.json();
  if(!response.ok||!info.configured)throw Error('MCP CLONED VOICE UNAVAILABLE');
  this.ready=true;this.onProgress?.({stage:'ready'});
 }
 async generate(text){
  if(!this.ready)throw Error('MCP CLONED VOICE UNAVAILABLE');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),95000);this.pending.add(controller);
  try{
   const response=await fetch(this.base+'/api/mcp/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'MCP CLONED VOICE UNAVAILABLE');
   const audio=await fetch(data.audioUrl,{signal:controller.signal});if(!audio.ok)throw Error('MCP AUDIO UNAVAILABLE');
   const context=new OfflineAudioContext(1,1,24000),buffer=await context.decodeAudioData(await audio.arrayBuffer());
   return {samples:buffer.getChannelData(0),sampleRate:buffer.sampleRate};
  }finally{clearTimeout(timer);this.pending.delete(controller);}
 }
 abort(){for(const request of this.pending)request.abort();this.pending.clear();}
 cancel(){this.abort();this.ready=false;}
}
