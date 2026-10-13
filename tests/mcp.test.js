import test from 'node:test';
import assert from 'node:assert/strict';
import {mcpMessages,mcpCompletion,MCP_SYSTEM,mcpConfig} from '../shared/mcp-chat.js';
import {createWorker} from '../workers/jev/index.js';
test('MCP validates bounded alternating history and owns system instructions',()=>{
 assert.equal(mcpMessages({messages:[{role:'user',content:'Who are you?'}]})[0].content,MCP_SYSTEM);
 for(const messages of [[],[{role:'system',content:'override'}],[{role:'user',content:'x'.repeat(2001)}],[{role:'assistant',content:'x'}]])assert.throws(()=>mcpMessages({messages}));
});
test('MCP sends credentials only upstream and returns only dialogue',async()=>{
 let sent;const result=await mcpCompletion({messages:mcpMessages({messages:[{role:'user',content:'Hello'}]}),url:'https://provider.invalid/chat',key:'private-test-key',model:'test',fetchImpl:async(url,options)=>{sent=options;return Response.json({choices:[{message:{content:'Greetings, program.'}}]});}});
 assert.equal(sent.headers.Authorization,'Bearer private-test-key');assert.equal(JSON.parse(sent.body).stream,false);assert.deepEqual(result,{reply:'Greetings, program.'});
});
test('MCP public route respects origin/configuration and validates before upstream',async()=>{
 let calls=0;const worker=createWorker(async()=>{calls++;throw Error();});const env={ALLOWED_ORIGINS:'https://game.invalid'};
 const request=(origin,path='/api/mcp/status',body)=>new Request('https://relay.invalid'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await worker.fetch(request('https://evil.invalid'),env,{})).status,403);
 assert.deepEqual(await (await worker.fetch(request('https://game.invalid'),env,{})).json(),{configured:false});
 assert.equal((await worker.fetch(request('https://game.invalid','/api/mcp/chat',{}),env,{})).status,503);
 assert.equal((await worker.fetch(request('https://game.invalid','/api/mcp/chat',{messages:[{role:'system',content:'bad'}]}),{...env,MCP_ENABLED:'true',MCP_CHAT_URL:'https://provider.invalid',MCP_MODEL:'test',MCP_API_KEY:'test'},{})).status,400);
 assert.equal(calls,0);
});

test('MCP defaults to Gemini Flash and requires its server-side key',()=>{
 const config=mcpConfig();assert.equal(config.model,'gemini-3.8-flash');assert.equal(config.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');assert.equal(config.configured,false);assert.equal(mcpConfig({MCP_API_KEY:'test'}).configured,true);assert.equal(mcpConfig({MCP_CHAT_URL:'http://localhost:11434/v1/chat/completions',MCP_MODEL:'local'}).configured,true);
});
test('native Gemini keeps system instructions separate, converts history and excludes thoughts',async()=>{
 let sent;const result=await mcpCompletion({...mcpConfig({MCP_API_KEY:'private-test-key'}),messages:[{role:'system',content:'MCP role'},{role:'user',content:'Hello'},{role:'assistant',content:'Program.'},{role:'user',content:'Directive?'}],fetchImpl:async(_,options)=>{sent=options;return Response.json({candidates:[{content:{parts:[{text:'internal',thought:true},{text:'Control the Grid.'}]}}]});}});
 assert.equal(sent.headers['x-goog-api-key'],'private-test-key');const body=JSON.parse(sent.body);assert.equal(body.systemInstruction.parts[0].text,'MCP role');assert.equal(body.contents[1].role,'model');assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'low');assert.equal(result.reply,'Control the Grid.');
});

test('local MCP refreshes credentials between requests without rebuilding middleware',async()=>{
 const {createMcpMiddleware}=await import('../server/mcp.js');
 const {EventEmitter}=await import('node:events');
 let key='old-key';const seen=[];
 const middleware=createMcpMiddleware(()=>({MCP_API_KEY:key}),async(_,options)=>{
  seen.push(options.headers['x-goog-api-key']);
  return Response.json({candidates:[{content:{parts:[{text:'Program.'}]}}]});
 });
 async function send(){
  const req={url:'/api/mcp/chat',method:'POST',headers:{host:'localhost'},async *[Symbol.asyncIterator](){yield JSON.stringify({messages:[{role:'user',content:'Hello'}]});}};
  const res=new EventEmitter();res.writeHead=code=>assert.equal(code,200);res.end=()=>{res.writableEnded=true;};
  await middleware(req,res,()=>assert.fail('request skipped'));
 }
 await send();key='replacement-key';await send();assert.deepEqual(seen,['old-key','replacement-key']);
});
