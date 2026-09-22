import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JevSpend} from '../server/jev-spend.js';
test('reported usage replaces reservations; missing usage retains them; rolling expiry',()=>{
 let now=0;const b=new JevSpend({limitUsd:1,clock:()=>now});
 const {entry}=b.reserve({state:'example'});assert(entry.usd>0);
 b.settle(entry,{input_tokens:1000000,output_tokens:99999999});assert.equal(b.status().spentUsd,.042);
 b.settle(entry,{input_tokens:NaN});assert.equal(b.status().spentUsd,.042);
 now=1000;b.reserve({state:'second'});now=3600000;assert(b.status().spentUsd>0);assert(b.status().spentUsd<.001);
 now=3601000;assert.equal(b.status().spentUsd,0);
});
test('budget denies before dispatch and survives restart with unresolved reservations',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tron-spend-'));
 try{
  const opts={limitUsd:.0002,clock:()=>0,path:join(dir,'spend.json')},b=new JevSpend(opts);
  assert(b.reserve({}).entry);assert.equal(b.reserve({}).retryAfter,3600);
  const restarted=new JevSpend(opts);assert.equal(restarted.status().spentUsd,b.status().spentUsd);assert(!restarted.reserve({}).entry);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
