import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import wasmModuleSource from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?raw';
import {ChatterboxModel,AutoTokenizer,AutoConfig,Tensor,env} from '@huggingface/transformers';
import {MCP_VOICE_MODEL as config,MCP_VOICE_FILES,mcpVoiceDtype} from './voice-model.js';
import {prepareVoiceFiles} from './download.js';
import {createVoiceModelCache} from './model-cache.js';
env.allowLocalModels=false;env.useBrowserCache=false;env.useCustomCache=true;env.customCache=createVoiceModelCache({onRead:({milliseconds,bytes})=>{cacheReadMilliseconds+=milliseconds;cacheReadBytes+=bytes;}});
let cacheReadMilliseconds=0,cacheReadBytes=0;
if(import.meta.env.DEV&&import.meta.env.VITE_MCP_MODEL_TEST_HOST)env.remoteHost=import.meta.env.VITE_MCP_MODEL_TEST_HOST;
// Pin tokenizer discovery too: Transformers.js 4.3 calls it without revision options.
env.remotePathTemplate='{model}/resolve/'+config.revision+'/';
const runtime={wasm:new URL(wasmUrl,self.location.href).href,mjs:URL.createObjectURL(new Blob([wasmModuleSource],{type:'application/javascript'}))};
env.backends.onnx.wasm.wasmPaths=runtime;
env.useWasmCache=false;
env.backends.onnx.wasm.numThreads=1;
let model,processor,speaker,activeRequest;
self.addEventListener('unhandledrejection',event=>{
 event.preventDefault();console.error('MCP unhandled initialization',event.reason?.stack||event.reason);self.postMessage({id:activeRequest,type:'error',message:'VOICE INITIALIZATION FAILED: '+String(event.reason?.message||event.reason)});
});
self.onmessage=async({data:{id,type,audio,text}})=>{
 activeRequest=id;
 try{
  if(type==='load'){
   if(!navigator.gpu||!await navigator.gpu.requestAdapter())throw new Error('MCP VOICE REQUIRES WEBGPU IN THIS BROWSER');
   const progress=p=>self.postMessage({type:'progress',...p}),timings={};
   const timed=async(name,work)=>{const start=performance.now();const result=await work();timings[name]=Math.round(performance.now()-start);return result;};
   cacheReadMilliseconds=0;cacheReadBytes=0;
   await timed('cacheCheckAndDownloadMilliseconds',()=>prepareVoiceFiles({cache:env.customCache,baseURL:env.remoteHost.replace(/\/$/,'')+'/'+config.id+'/resolve/'+config.revision+'/',files:{...MCP_VOICE_FILES,[runtime.wasm]:26861777},onProgress:progress}));
   progress({stage:'initializing',component:'Reading voice runtime'});
   env.backends.onnx.wasm.wasmBinary=await timed('runtimeReadMilliseconds',async()=>(await env.customCache.match(runtime.wasm)).arrayBuffer());
   const options={revision:config.revision,progress_callback:()=>{}};
   const modelConfig=await AutoConfig.from_pretrained(config.id,options);
   // The conversion omits this metadata, causing generic model.onnx probes.
   modelConfig.architectures=['ChatterboxModel'];
   processor=await timed('tokenizerMilliseconds',()=>AutoTokenizer.from_pretrained(config.id,options));
   progress({stage:'initializing',component:'Loading model and building GPU sessions'});
   model=await timed('modelAndGpuMilliseconds',()=>ChatterboxModel.from_pretrained(config.id,{...options,config:modelConfig,device:'webgpu',dtype:mcpVoiceDtype('webgpu')}));
   progress({stage:'conditioning',component:'Preparing MCP voice sample'});
   speaker=await timed('referenceConditioningMilliseconds',()=>model.encode_speech(new Tensor('float32',audio,[1,audio.length])));
   timings.cacheReadMilliseconds=Math.round(cacheReadMilliseconds);timings.cacheReadBytes=cacheReadBytes;
   self.postMessage({id,type:'ready',timings});
  }else if(type==='generate'){
   if(!speaker)throw new Error('MCP VOICE IS NOT LOADED');
   const waveform=await model.generate({...await processor(text),...speaker,exaggeration:config.exaggeration,max_new_tokens:config.maxNewTokens});
   const samples=new Float32Array(waveform.data);
   self.postMessage({id,type:'audio',samples,sampleRate:config.sampleRateHz},[samples.buffer]);
  }
 }catch(error){self.postMessage({id,type:'error',message:error.message});}
};
