import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {JevBudget,limitsFor} from '../workers/jev/budget.js';
import {createWorker} from '../workers/jev/index.js';
const state={self:{id:1},options:[{id:'m0',kind:'hold',goal:{x:0,s:0},route:[]}]};
function storage(){
 const db=new DatabaseSync(':memory:');
 return {sql:{exec(query,...args){if(query.includes('CREATE TABLE')){db.exec(query);return [];}return db.prepare(query).all(...args);}},
 transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
test('durable quotas survive object recreation, bound bytes and reset at UTC midnight',()=>{
 const ctx={storage:storage()},env={DAILY_REQUESTS:'2',DAILY_INPUT_BYTES:'100'};
 let budget=new JevBudget(ctx,env);
 assert.equal(budget.reserve('a',60,1000).ok,true);
 budget=new JevBudget(ctx,env);
 assert.equal(budget.reserve('b',41,2000).ok,false);
 assert.equal(budget.reserve('b',40,2000).ok,true);
 assert.equal(budget.reserve('c',1,3000).ok,false);
 assert.equal(budget.reserve('c',60,86400000).ok,true);
 assert.throws(()=>limitsFor({DAILY_REQUESTS:'NaN'}));
 assert.equal(new JevBudget({storage:storage()},{DAILY_REQUESTS:'0'}).reserve('a',1).ok,false);
});
test('per-IP pacing, concurrency, lease expiry and release prevent overlapping requests',async()=>{
 const b=new JevBudget({storage:storage()},{IP_MINUTE_REQUESTS:'2',IP_DAILY_REQUESTS:'3'});
 const first=b.reserve('a',1,1000);assert.equal(first.ok,true);
 assert.equal(b.reserve('a',1,1100).ok,false);
 assert.equal(b.reserve('a',1,2000).ok,false);
 await b.fetch(new Request('https://budget/release',{method:'POST',body:JSON.stringify({lease:first.lease})}));
 assert.equal(b.reserve('a',1,2000).ok,true);
 assert.equal(b.reserve('a',1,20000).ok,false);
 assert.equal(b.reserve('a',1,61000).ok,true);
 assert.equal(b.reserve('a',1,121000).ok,false);
 const c=new JevBudget({storage:storage()},{});
 for(let i=0;i<4;i++)assert.equal(c.reserve(String(i),1,1000).ok,true);
 assert.equal(c.reserve('extra',1,1000).ok,false);
 assert.equal(c.reserve('extra',1,11000).ok,true);
});
function fixture({env:overrides={},upstream}={}){
 const budget=new JevBudget({storage:storage()},overrides),pending=[],calls=[];
 const env={ALLOWED_ORIGINS:'https://dekorte.com',JEV_ENABLED:'true',TYPESAFE_API_KEY:'private-test',
 JEV_BUDGET:{idFromName:()=>1,get:()=>({fetch:(url,init)=>budget.fetch(new Request(url,init))})},...overrides};
 const worker=createWorker(async(url,init)=>{calls.push({url,...init});return upstream?upstream():Response.json({answers:{maneuver:{choice:'m0',confidence:.9}}});});
 return {calls,pending,invoke:({method='POST',path='/api/jev/decision',origin='https://dekorte.com',body=state,headers={}}={})=>worker.fetch(new Request('https://worker.test'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1','Content-Type':'application/json',...headers},...(['POST','PUT'].includes(method)?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),env,{waitUntil:p=>pending.push(p)})};
}
test('public proxy restricts origins and bodies before spending quota',async()=>{
 const f=fixture();
 assert.equal((await f.invoke({origin:'https://foreign.test'})).status,403);
 const preflight=await f.invoke({method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://dekorte.com');
 assert.equal((await f.invoke({body:'invalid'})).status,400);
 assert.equal((await f.invoke({body:{self:{},options:[]}})).status,400);
 assert.equal((await f.invoke({body:' '.repeat(32769)})).status,413);
 assert.equal((await f.invoke({headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal(f.calls.length,0);
 const status=await f.invoke({method:'GET',path:'/api/jev/status'});assert.equal((await status.json()).configured,true);
});
test('proxy isolates credentials, validates choices and releases reservations',async()=>{
 const f=fixture(),response=await f.invoke(),value=await response.json();
 assert.equal(response.status,200);assert.equal(value.id,'m0');
 assert.equal(f.calls[0].headers.Authorization,'Bearer private-test');
 assert.ok(!JSON.stringify(value).includes('private-test'));assert.ok(!f.calls[0].body.includes('private-test'));
 await Promise.all(f.pending);
 assert.equal((await f.invoke()).status,429);
 const invalid=fixture({upstream:()=>Response.json({answers:{maneuver:{choice:'invented',confidence:1}}})});
 assert.equal((await invalid.invoke()).status,502);await Promise.all(invalid.pending);
});
test('disabled, exhausted or unavailable budget never calls provider',async()=>{
 for(const [env,code] of [[{JEV_ENABLED:'false'},503],[{DAILY_REQUESTS:'0'},429],[{JEV_BUDGET:null},503]]){
  const f=fixture({env}),r=await f.invoke();assert.equal(r.status,code);assert.ok(Number(r.headers.get('Retry-After'))>0);assert.equal(f.calls.length,0);
 }
});

test('public Bit questions share the existing budget and response contract',async()=>{
 const f=fixture(),response=await f.invoke({body:{controller:'bit',question:'Are you Bit?'}});
 assert.equal(response.status,200);assert.equal((await response.json()).id,'m0');
 assert.deepEqual(Object.keys(JSON.parse(f.calls[0].body).questions.maneuver.criteria),['m0','m1','m2']);
 await Promise.all(f.pending);
 assert.equal((await f.invoke({body:{controller:'bit',question:'Can you speak?'}})).status,429);
});


test('explicit unlimited quotas allow use after previous shared and player caps are exhausted',()=>{
 const env={DAILY_REQUESTS:'unlimited',DAILY_INPUT_BYTES:'unlimited',IP_DAILY_REQUESTS:'unlimited',IP_MINUTE_REQUESTS:'unlimited'};
 const ctx={storage:storage()},budget=new JevBudget(ctx,env),now=100000;
 const day=Math.floor(now/86400000),minute=Math.floor(now/60000);
 ctx.storage.sql.exec('INSERT INTO days VALUES(?,?,?)',day,1000000,1000000000);
 ctx.storage.sql.exec('INSERT INTO clients VALUES(?,?,?,?,?,?)',day,'a',1000000,minute,100000,0);
 for(const name of ['dailyRequests','dailyInputBytes','ipDailyRequests','ipMinuteRequests'])assert.equal(budget.limits[name],Infinity);
 const result=budget.reserve('a',60000,now);assert.equal(result.ok,true);
 assert.equal(budget.reserve('a',1,now+1).ok,false); // Overlapping requests still wait.
 assert.throws(()=>limitsFor({DAILY_REQUESTS:'Infinity'}));
});
