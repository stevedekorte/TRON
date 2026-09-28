import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createJevMiddleware,jevQuestion} from '../server/jev.js';
import {JevClient} from '../src/ai/jev-client.js';
import {config} from '../src/game/config.js';
import {createRun} from '../src/simulation/run.js';
import {chooseManeuver} from '../src/simulation/tactical.js';
const state={self:{id:1},target:null,options:[{id:'m0',kind:'hold',goal:{x:0,s:0,y:80,yaw:0},route:[],localScore:1}]};
async function invoke(middleware,{method='POST',url='/api/jev/decision',origin='http://localhost:5173',body=state}={}){
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.url=url;req.headers={host:'localhost:5173',origin};
 const res=new EventEmitter();res.writeHead=status=>res.status=status;res.end=data=>{res.body=JSON.parse(data);res.writableEnded=true;};
 await middleware(req,res,()=>{throw new Error('unexpected route');});return res;
}
test('server rejects missing key, foreign origin and malformed options without calling upstream',async()=>{
 let calls=0;const m=createJevMiddleware({fetchImpl:()=>{calls++;}});
 assert.equal((await invoke(m)).status,503);assert.equal((await invoke(m,{origin:'https://elsewhere.test'})).status,403);
 const keyed=createJevMiddleware({apiKey:'private-test',fetchImpl:()=>{calls++;}});
 assert.equal((await invoke(keyed,{body:{self:{},options:[{id:'bad',kind:'hold',goal:{x:0,s:0}}]}})).status,400);assert.equal(calls,0);
 const status=await invoke(keyed,{method:'GET',url:'/api/jev/status'});assert.equal(status.body.configured,true);assert.ok(!JSON.stringify(status.body).includes('private-test'));
});
test('valid structured choice, secret isolation, response validation and request limits',async()=>{
 let now=0,request;
 const m=createJevMiddleware({apiKey:'private-test',clock:()=>now,fetchImpl:async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({answers:{maneuver:{choice:'m0',confidence:.9,probabilities:{m0:1}}}})};}});
 const result=await invoke(m);assert.equal(result.status,200);assert.equal(result.body.id,'m0');assert.equal(request.headers.Authorization,'Bearer private-test');assert.ok(!request.body.includes('private-test'));assert.ok(!JSON.stringify(result.body).includes('private-test'));
 assert.equal(JSON.parse(request.body).questions.maneuver.type,'choice');assert.equal((await invoke(m)).status,429);now=1000;assert.equal((await invoke(m)).status,200);
 const bad=createJevMiddleware({apiKey:'x',fetchImpl:async()=>({ok:true,json:async()=>({answers:{maneuver:{choice:'invented',confidence:1}}})})});assert.equal((await invoke(bad)).status,502);
});
test('timed-out provider produces explicit local fallback',async()=>{
 const m=createJevMiddleware({apiKey:'x',limits:{bodyBytes:65536,intervalMs:1,hourlyRequests:10,timeoutMs:10},fetchImpl:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
 const result=await invoke(m);assert.equal(result.status,502);assert.match(result.body.error,/timed out/);
});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('public client uses configured relay and retains server cooldown across resets',async()=>{
 const before=config.aiMode;config.aiMode='jev';let calls=0,url;
 const client=new JevClient(async target=>{calls++;url=target;return new Response(JSON.stringify({error:'Daily allowance reached'}),{status:429,headers:{'Retry-After':'3600'}});},'https://proxy.test/');
 try{const {r}=scenario();client.update(r,true);await flush();assert.equal(url,'https://proxy.test/api/jev/decision');assert.match(client.status,/Local fallback/);assert.equal(client.warning.label,'JEV LIMIT');client.update(r,false);assert.equal(client.warning.label,'JEV LIMIT');client.resetScheduling();client.update(scenario().r,true);assert.equal(calls,1);assert.equal(client.warning.label,'JEV LIMIT');}
 finally{config.aiMode=before;client.dispose();}
});
function scenario(){const r=createRun(1982),e=r.recognizers[0];r.recognizers=[e];r.enemyTanks=[];Object.assign(e,{x:-5000,s:-5000,y:80,memory:{x:-5000,s:-4900,seenAt:0,vx:0,vs:0}});chooseManeuver(e,0,[e]);return {r,e};}
test('client never calls API in classic/local mode and ignores answers after pause/reset',async()=>{
 const before=config.aiMode;let calls=0,resolve;
 const client=new JevClient(()=>{calls++;return new Promise(r=>resolve=r);});
 try{
  const {r,e}=scenario();config.aiMode='classic';client.update(r,true);config.aiMode='local';client.update(r,true);assert.equal(calls,0);
  config.aiMode='jev';client.update(r,true);assert.equal(calls,1);client.update(r,false);
  resolve({ok:true,json:async()=>({id:e.tactical.options[0].id,confidence:1})});await flush();assert.equal(e.tactical.source,'local');assert.equal(client.history.length,0);
  const fresh=scenario();client.update(fresh.r,true);client.resetScheduling();resolve({ok:true,json:async()=>({id:fresh.e.tactical.options[0].id,confidence:1})});await flush();assert.equal(fresh.e.tactical.source,'local');
 }finally{config.aiMode=before;client.dispose();}
});
test('client accepts current valid answer and labels errors as local fallback',async()=>{
 const before=config.aiMode;config.aiMode='jev';
 const {r,e}=scenario(),client=new JevClient(async()=>({ok:true,json:async()=>({id:e.tactical.options[0].id,confidence:1})}));
 try{client.update(r,true);await flush();assert.equal(e.tactical.source,'jev');assert.equal(client.history.length,1);
  await new Promise(resolve=>setTimeout(resolve,660));client.resetScheduling();client.transport.fetchImpl=async()=>({ok:false,json:async()=>({error:'No key'})});e.tactical.requested=null;client.update(r,true);await flush();assert.match(client.status,/Local fallback: No key/);
  assert.equal(client.warning.label,'JEV UNAVAILABLE');await new Promise(resolve=>setTimeout(resolve,660));client.resetScheduling();e.tactical.requested=null;client.transport.fetchImpl=async()=>({ok:true,json:async()=>({id:e.tactical.options[0].id,confidence:0})});client.update(r,true);await flush();assert.equal(client.warning,null);assert.match(client.status,/uncertain/);
 }finally{config.aiMode=before;client.dispose();}
});


test('Jev uses only nearby fresh knowledge and rejects replies after leaving range',async()=>{
 const {MAZE_LENGTH}=await import('../src/levels/maze.js');
 const before=config.aiMode;config.aiMode='jev';let calls=0,resolve;
 const client=new JevClient(()=>{calls++;return new Promise(r=>resolve=r);});
 try{
  const {r,e}=scenario(),memory={...e.memory};
  e.memory=null;client.update(r,true);assert.equal(calls,0);
  e.memory={...memory,x:e.x+MAZE_LENGTH+1,s:e.s};Object.assign(r,{x:e.x,s:e.s});client.update(r,true);assert.equal(calls,0);
  e.memory={...memory,seenAt:-39};client.update(r,true);assert.equal(calls,0);
  e.memory=memory;Object.assign(r,{x:999999,s:999999});client.update(r,true);assert.equal(calls,1);
  e.x+=MAZE_LENGTH*2;
  resolve({ok:true,json:async()=>({id:e.tactical.options[0].id,confidence:1})});await flush();
  assert.equal(client.history[0].accepted,false);assert.equal(e.tactical.source,'local');
 }finally{config.aiMode=before;client.dispose();}
});

test('local pacing and dollar budget have distinct messages and retry delays',async()=>{
 let now=0;
 const middleware=createJevMiddleware({apiKey:'test',clock:()=>now,limits:{bodyBytes:65536,intervalMs:600,hourlyUsd:.0004,timeoutMs:100},fetchImpl:async()=>Response.json({answers:{maneuver:{choice:'m0',confidence:1}},usage:{input_tokens:5000}})});
 assert.equal((await invoke(middleware)).status,200);
 const fast=await invoke(middleware);assert.match(fast.body.error,/too close together/);assert.equal(fast.body.retryAfter,1);
 now=650;const capped=await invoke(middleware);assert.equal(capped.status,429);assert.match(capped.body.error,/rolling-hour budget/);
 now=3600000;assert.equal((await invoke(middleware,{method:'GET',url:'/api/jev/status'})).body.budget.remainingUsd,.0004);
});

test('Bit questions use fixed yes/no/unsure choices and the existing private relay',async()=>{
 const question={controller:'bit',question:'Are you Bit?'};
 const payload=jevQuestion(question);
 assert.deepEqual(Object.keys(payload.questions.maneuver.criteria),['m0','m1','m2']);
 assert.equal(JSON.parse(payload.state).question,question.question);
 for(const value of ['',null,' '.repeat(10),'x'.repeat(1001)])assert.throws(()=>jevQuestion({controller:'bit',question:value}));
 const middleware=createJevMiddleware({apiKey:'private-test',fetchImpl:async()=>Response.json({answers:{maneuver:{choice:'m1',confidence:.95}}})});
 const response=await invoke(middleware,{body:question});
 assert.equal(response.status,200);assert.equal(response.body.id,'m1');
 assert.equal((await invoke(middleware,{body:question})).status,429);
});
