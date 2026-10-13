// Remove only retired MCP model data, preserving game assets and other models.
export async function clearLegacyMcpCache(){
 const tasks=[];
 if(globalThis.indexedDB)tasks.push(new Promise((resolve,reject)=>{
  const request=indexedDB.deleteDatabase('tron-mcp-voice-models');
  request.onsuccess=()=>resolve();
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>{console.info('Old MCP voice cache will be removed when older tabs close.');resolve();};
 }));
 if(globalThis.caches)tasks.push((async()=>{
  for(const name of await caches.keys()){
   const cache=await caches.open(name);
   for(const request of await cache.keys()){
    if(/chatterbox-ONNX|ort-wasm-simd-threaded\.asyncify|voice\.worker-/i.test(request.url))await cache.delete(request);
   }
  }
 })());
 const results=await Promise.allSettled(tasks);
 for(const result of results)if(result.status==='rejected')console.warn('Old MCP cache cleanup will retry on next visit.');
}
