import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVoiceFiles} from '../src/mcp/download.js';
import {mcpCompletion,mcpError} from '../shared/mcp-chat.js';
const memoryCache=()=>{const store=new Map();return {store,match:async key=>store.get(key)?.clone(),put:async(key,response)=>{store.set(key,response);}};};
test('voice total includes cached bytes, gives ETA, and reload performs no downloads',async()=>{
 const cache=memoryCache(),events=[];await cache.put('model/a',new Response(new Uint8Array(4),{headers:{'content-length':'4'}}));
 let calls=0,clock=0;const options={cache,baseURL:'model/',files:{a:4,b:6},onProgress:p=>events.push(p),now:()=>clock+=1500,fetchImpl:async()=>{calls++;return new Response(new Uint8Array(6));}};
 await prepareVoiceFiles(options);assert.equal(calls,1);assert.equal(events.at(-1).totalBytes,10);assert.equal(events.at(-1).cachedBytes,4);assert.equal(events.at(-1).downloadedBytes,6);assert(events.some(p=>p.etaSeconds!==null));
 await prepareVoiceFiles(options);assert.equal(calls,1);assert.equal(events.at(-1).cachedBytes,10);
});
test('partial voice downloads never become cache hits',async()=>{
 const cache=memoryCache();await assert.rejects(prepareVoiceFiles({cache,baseURL:'model/',files:{a:8},onProgress:()=>{},fetchImpl:async()=>new Response(new Uint8Array(4))}),/INCOMPLETE/);assert.equal(cache.store.size,0);
});
test('Gemini request reserves reasoning space and exposes only safe provider errors',async()=>{
 let body;await mcpCompletion({model:'gemini-3.8-flash',url:'https://example.invalid',messages:[],key:'secret',fetchImpl:async(_,options)=>{body=JSON.parse(options.body);return Response.json({choices:[{message:{content:'Hello'}}]});}});assert.equal(body.reasoning_effort,'low');assert.equal(body.max_tokens,1024);
 assert.equal(mcpError({providerStatus:429,message:'secret'}).status,429);assert.equal(mcpError({providerStatus:503}).status,503);assert.equal(mcpError({name:'TimeoutError'}).status,504);assert(!JSON.stringify(mcpError({providerStatus:403,message:'secret'})).includes('secret'));
});
test('temporary provider failures retry with bounded backoff; access failures do not',async()=>{
 let calls=0;const waits=[];
 const args={model:'gemini-3.8-flash',url:'https://example.invalid',messages:[],key:'secret',wait:async ms=>waits.push(ms)};
 const result=await mcpCompletion({...args,fetchImpl:async()=>++calls<3?new Response('',{status:503}):Response.json({choices:[{message:{content:'End of line.'}}]})});
 assert.equal(result.reply,'End of line.');assert.equal(calls,3);assert.deepEqual(waits,[500,1000]);
 calls=0;await assert.rejects(mcpCompletion({...args,fetchImpl:async()=>{calls++;return new Response('',{status:503});}}));assert.equal(calls,3);
 calls=0;await assert.rejects(mcpCompletion({...args,fetchImpl:async()=>{calls++;return new Response('',{status:403});}}));assert.equal(calls,1);
});
test('download completion is not initialization until the cache write commits',async()=>{
 const events=[];let release;const writing=new Promise(resolve=>release=resolve);
 const work=prepareVoiceFiles({cache:{match:async()=>undefined,put:()=>writing},baseURL:'model/',files:{a:4},onProgress:p=>events.push(p.stage),fetchImpl:async()=>new Response(new Uint8Array(4))});
 while(!events.includes('saving'))await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(events.at(-1),'saving');assert(!events.includes('initializing'));release();await work;assert.equal(events.at(-1),'initializing');
});

 test('cached startup checks metadata without opening large model streams',async()=>{
  let reads=0;await prepareVoiceFiles({cache:{size:async()=>4,match:async()=>{reads++;throw Error('Unnecessary model read');}},baseURL:'model/',files:{a:4},onProgress:()=>{},fetchImpl:async()=>assert.fail('Unexpected download')});assert.equal(reads,0);
 });
