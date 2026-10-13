import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleCycleReaction} from '../src/simulation/cycle-reaction.js';
test('per-rider Gaussian timing is bounded, varied, reproducible and centered on its mean',()=>{
 const bike={reactionTiming:{meanSeconds:.25,standardDeviationSeconds:.04,minSeconds:.1,maxSeconds:.4}};
 const samples=()=>{let seed=1982;return Array.from({length:10000},()=>sampleCycleReaction(bike,()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)));};
 const values=samples(),mean=values.reduce((a,b)=>a+b)/values.length;
 const sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
 assert(values.every(v=>v>=.1&&v<=.4));assert(Math.abs(mean-.25)<.002);assert(Math.abs(sd-.04)<.002);
 assert.deepEqual(values,samples());
});
test('zero variation produces the rider mean',()=>{
 assert.equal(sampleCycleReaction({reactionTiming:{meanSeconds:.2,standardDeviationSeconds:0,minSeconds:.1,maxSeconds:.3}},()=>.5),.2);
});
