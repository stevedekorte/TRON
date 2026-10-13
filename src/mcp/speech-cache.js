import {MCP_VOICE_EFFECTS} from './voice-effects.js';
// Bump when the reference voice, hosted model, or processing algorithm changes.
// Numeric effect adjustments also change the key automatically.
export const MCP_VOICE_ID='mcp-chatterbox-turbo-v1';
export const MCP_AUDIO_VERSION=JSON.stringify([MCP_VOICE_ID,'effects-v1',MCP_VOICE_EFFECTS]);
const DATABASE='tron-mcp-rendered-speech';
export class McpSpeechCache{
 constructor(version=MCP_AUDIO_VERSION){this.version=version;this.opening=null;}
 async open(){
  if(!globalThis.indexedDB)return null;
  return this.opening??=new Promise((resolve,reject)=>{
   const request=indexedDB.open(DATABASE,1);
   request.onupgradeneeded=()=>{request.result.createObjectStore('audio',{keyPath:'key'});request.result.createObjectStore('metadata');};
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{
    const db=request.result;db.onversionchange=()=>{db.close();this.opening=null;};
    const transaction=db.transaction(['audio','metadata'],'readwrite'),metadata=transaction.objectStore('metadata');
    const current=metadata.get('voiceVersion');
    current.onsuccess=()=>{if(current.result!==this.version){transaction.objectStore('audio').clear();metadata.put(this.version,'voiceVersion');}};
    transaction.oncomplete=()=>resolve(db);transaction.onabort=()=>{db.close();reject(transaction.error);};
   };
  }).catch(error=>{console.warn('MCP audio cache unavailable:',error?.message);return null;});
 }
 key(text){return JSON.stringify([this.version,text.trim().replace(/\s+/g,' ')]);}
 async get(text){
  try{
   const db=await this.open();if(!db)return null;
   return await new Promise((resolve,reject)=>{
    const request=db.transaction('audio').objectStore('audio').get(this.key(text));
    request.onerror=()=>reject(request.error);request.onsuccess=()=>{
     const data=request.result;
     resolve(data?.processed===true&&data.samples instanceof Float32Array&&data.samples.length&&data.sampleRate>0?{samples:data.samples,sampleRate:data.sampleRate,processed:true}:null);
    };
   });
  }catch(error){console.warn('MCP audio cache read failed:',error?.message);return null;}
 }
 async put(text,audio){
  try{
   const db=await this.open();if(!db)return;
   await new Promise((resolve,reject)=>{
    const transaction=db.transaction('audio','readwrite');
    transaction.objectStore('audio').put({key:this.key(text),...audio});
    transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error);
   });
  }catch(error){console.warn('MCP audio cache write failed:',error?.message);}
 }
 async close(){const db=await this.opening;db?.close();this.opening=null;}
}
