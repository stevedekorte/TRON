import test from 'node:test';import assert from 'node:assert/strict';
import {JevStats} from '../src/ai/jev-stats.js';
const snapshot={self:{},options:[{id:'m0',kind:'hold',goal:{x:0,s:0},route:[]}]};
test('round counters, ten-second rate, reported and estimated costs',()=>{
 let now=0;const s=new JevStats(()=>now),a=s.sent(snapshot);assert.equal(s.value.requests,1);assert.equal(s.value.requestsPerSecond,.1);assert.equal(s.value.estimatedRequests,1);
 s.settle(a,{input_tokens:1000});assert(Math.abs(s.value.costUsd-.000042)<1e-12);assert.equal(s.value.estimatedRequests,0);
 now=5000;s.sent(snapshot);assert.equal(s.value.requests,2);now=10000;assert.equal(s.value.requestsPerSecond,.1);assert.equal(s.value.requests,2);assert.equal(s.value.estimatedRequests,1);
 s.reset();assert.deepEqual(s.value,{requests:0,requestsPerSecond:0,costUsd:0,estimatedRequests:0});
});
