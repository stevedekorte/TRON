import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createWorker} from '../../workers/jev/index.js';
import {ERROR_REPORT_LIMITS,cleanErrorReport} from '../../workers/jev/errors.js';
import {buildErrorReport,setErrorContext,ERROR_REPORTING} from '../../src/analytics/error-reporter.js';

// Minimal D1 stand-in over node:sqlite with the schema migration applied.
function d1(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../../workers/jev/migrations/0001_error_reports.sql',import.meta.url),'utf8'));
 return {db,prepare(sql){return {bind(...args){const st=db.prepare(sql);return {first:async()=>st.get(...args)??null,run:async()=>st.run(...args)};}};}};
}
const ORIGIN='https://encomterminal.com';
function post(body,{ip='203.0.113.9',origin=ORIGIN,type='application/json',method='POST'}={}){
 return new Request('https://relay.example/api/errors',{method,headers:{Origin:origin,'Content-Type':type,'CF-Connecting-IP':ip},body:method==='POST'?(typeof body==='string'?body:JSON.stringify(body)):undefined});
}
const report=(extra={})=>({kind:'error',message:'TypeError: x is undefined',stack:'at f (game.js:1:2)',source:'game.js:1:2',build:'abc1234',host:'encomterminal.com',path:'/',userAgent:'Firefox/140',gpu:'Apple M5',game:'cycles',mode:'running',detail:'cycle',uptimeSeconds:42,...extra});
const env=db=>({ALLOWED_ORIGINS:ORIGIN,ERROR_REPORTS:db,ERROR_REPORT_SALT:'salt'});
const ctx={waitUntil(){}};

test('error reports are stored without IPs, trimmed and validated',async()=>{
 const db=d1(),worker=createWorker();
 const ok=await worker.fetch(post(report({message:'m'.repeat(900),extra:'ignored'})),env(db),ctx);
 assert.equal(ok.status,202);assert.equal(ok.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 const row=db.db.prepare('SELECT * FROM error_reports').get();
 assert.equal(row.message.length,500);assert.equal(row.gpu,'Apple M5');assert.equal(row.uptime_seconds,42);
 assert(!JSON.stringify(row).includes('203.0.113.9'),'no IP stored');
 assert.equal((await worker.fetch(post(report({kind:'nope'})),env(db),ctx)).status,400);
 assert.equal((await worker.fetch(post('{bad'),env(db),ctx)).status,400);
 assert.equal((await worker.fetch(post(report({stack:'s'.repeat(ERROR_REPORT_LIMITS.bodyBytes)})),env(db),ctx)).status,413);
 assert.equal((await worker.fetch(post(report(),{type:'text/plain'}),env(db),ctx)).status,415);
 assert.equal((await worker.fetch(post(report(),{origin:'https://evil.example'}),env(db),ctx)).status,403);
 assert.equal((await worker.fetch(post(null,{method:'GET'}),env(db),ctx)).status,405);
 assert.equal((await worker.fetch(post(report()),{ALLOWED_ORIGINS:ORIGIN},ctx)).status,503,'no database binding');
 const preflight=await worker.fetch(new Request('https://relay.example/api/errors',{method:'OPTIONS',headers:{Origin:ORIGIN}}),env(db),ctx);
 assert.equal(preflight.status,204);
 assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM error_reports').get().n,1);
});

test('error reports are rate limited per rotating client',async()=>{
 const db=d1(),worker=createWorker();
 for(let i=0;i<ERROR_REPORT_LIMITS.clientPerHour;i++)assert.equal((await worker.fetch(post(report()),env(db),ctx)).status,202);
 const limited=await worker.fetch(post(report()),env(db),ctx);
 assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'3600');
 assert.equal((await worker.fetch(post(report(),{ip:'198.51.100.4'}),env(db),ctx)).status,202,'other clients unaffected');
});

test('client reports carry bounded context and never throw on bad input',()=>{
 setErrorContext(()=>({game:'cycles',mode:'running',gpu:'GPU',detail:'cycle'}));
 const r=buildErrorReport('rejection',new TypeError('boom'),{source:'a.js',line:3,column:4});
 assert.equal(r.kind,'rejection');assert.equal(r.message,'TypeError: boom');assert.equal(r.source,'a.js:3:4');assert.equal(r.game,'cycles');
 assert.doesNotThrow(()=>cleanErrorReport(r));
 const circular={};circular.self=circular;
 setErrorContext(()=>{throw new Error('context failed');});
 const odd=buildErrorReport('weird',circular);
 assert.equal(odd.kind,'error');assert.equal(odd.game,'');assert(odd.message.length<=ERROR_REPORTING.maxMessageChars);
 setErrorContext(null);
});
