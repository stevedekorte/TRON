// Separate from the game's service-worker cache. Download only on MCP entry.
export function createVoiceModelCache({onRead=()=>{}}={}){
 let database;
 const open=()=>database??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('tron-mcp-voice-models',2);
  request.onupgradeneeded=()=>{for(const name of ['files','chunks'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 async function read(store,key){const started=performance.now(),db=await open();return new Promise((resolve,reject)=>{const request=db.transaction(store).objectStore(store).get(key);request.onsuccess=()=>{onRead({store,milliseconds:performance.now()-started,bytes:request.result instanceof ArrayBuffer?request.result.byteLength:0});resolve(request.result);};request.onerror=()=>reject(request.error);});}
 return {
  async size(key){const entry=await read('files',String(key));if(!entry||entry.chunkCount===undefined&&entry.body.size>512*1024*1024)return undefined;return entry.body.size;},
  async match(key){
   key=String(key);const entry=await read('files',key);if(!entry)return undefined;
   if(entry.chunkCount===undefined){
    // Chrome may retain an unreadable Blob above 512 MiB; replace that legacy entry.
    if(entry.body.size>512*1024*1024)return undefined;
    return new Response(entry.body,{headers:entry.headers});
   }
   let index=0;
   return new Response(new ReadableStream({async pull(controller){
    if(index===entry.chunkCount){controller.close();return;}
    try{const chunk=await read('chunks',[key,index++]);if(!chunk)throw Error('MCP VOICE CACHE INCOMPLETE');controller.enqueue(new Uint8Array(chunk));}catch(error){controller.error(error);}
   }}),{headers:entry.headers});
  },
  async put(key,response){
   key=String(key);
   // Each record is bounded to avoid both large-Blob streaming failures and
   // IndexedDB's per-record serialization limit. Commit all chunks atomically.
   const reader=response.body.getReader(),chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;for(let offset=0;offset<value.byteLength;offset+=16*1024*1024)chunks.push(value.slice(offset,offset+16*1024*1024).buffer);}
   const body={size},headers=[...response.headers],db=await open();
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(['files','chunks'],'readwrite'),store=tx.objectStore('chunks');
    store.delete(IDBKeyRange.bound([key,0],[key,Number.MAX_SAFE_INTEGER]));
    chunks.forEach((chunk,i)=>store.put(chunk,[key,i]));
    tx.objectStore('files').put({body,chunkCount:chunks.length,headers},key);
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  },
  async delete(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['files','chunks'],'readwrite');tx.objectStore('files').delete(String(key));tx.objectStore('chunks').delete(IDBKeyRange.bound([String(key),0],[String(key),Number.MAX_SAFE_INTEGER]));tx.oncomplete=()=>resolve(true);tx.onabort=()=>reject(tx.error);});},
 };
}
