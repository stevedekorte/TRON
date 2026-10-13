import test from 'node:test';
import assert from 'node:assert/strict';
import {mcpSpeech,speechText,MCP_SPEECH} from '../shared/mcp-speech.js';
import {createWorker} from '../workers/jev/index.js';
test('Fal receives only server credentials and the fixed MCP reference',async()=>{
 let input;
 const out=await mcpSpeech({text:'End of line.',key:'private-test',fetchImpl:async(url,options)=>{
  assert.equal(url,MCP_SPEECH.endpoint);input=options;
  return Response.json({audio:{url:'https://v3.fal.media/test.wav'}});
 }});
 assert.equal(input.headers.Authorization,'Key private-test');
 assert.equal(JSON.parse(input.body).audio_url,MCP_SPEECH.reference);
 assert(MCP_SPEECH.endpoint.endsWith('/turbo'));
 assert.equal(JSON.parse(input.body).temperature,.7);
 assert.equal(JSON.parse(input.body).exaggeration,undefined);
 assert.deepEqual(out,{audioUrl:'https://v3.fal.media/test.wav'});
 assert.throws(()=>speechText({text:''}));assert.throws(()=>speechText({text:'a'.repeat(1001)}));
 await assert.rejects(mcpSpeech({text:'test',key:'secret',fetchImpl:async()=>Response.json({audio:{url:'http://localhost/private'}})}));
});
test('voice route enforces origin, configuration and input without exposing the key',async()=>{
 let calls=0;const worker=createWorker(async()=>{calls++;return Response.json({audio:{url:'https://v3.fal.media/test.wav'}})});
 const env={ALLOWED_ORIGINS:'https://game.invalid',MCP_ENABLED:'true',FAL_KEY:'private-test',JEV_BUDGET:{idFromName:()=>0,get:()=>({fetch:async url=>Response.json(url.endsWith('reserve')?{ok:true,lease:'x'}:{})})}};
 const request=(path,body,origin='https://game.invalid')=>new Request('https://relay.invalid/api/mcp/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await worker.fetch(request('speech',{text:'hello'},'https://evil.invalid'),env,{})).status,403);
 assert.equal((await worker.fetch(request('speech',{text:''}),env,{})).status,400);
 assert.deepEqual(await(await worker.fetch(request('voice-status'),env,{})).json(),{configured:true});
 assert.deepEqual(await(await worker.fetch(request('speech',{text:'Hello'}),env,{waitUntil:()=>{}})).json(),{audioUrl:'https://v3.fal.media/test.wav'});
 assert.equal(calls,1);
});
