import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../../src/simulation/game-session.js';
import {finishStartupAsync} from '../../src/simulation/startup-work.js';
test('cooperative startup preserves seeded enemies and session initialization',async()=>{
 const options={seed:123456},sync=new GameSession(options);let yields=0;
 const asyncSession=await GameSession.create(options,async()=>{yields++;});
 assert(yields>0);
 assert.deepEqual(asyncSession.run,sync.run);
 assert.deepEqual(asyncSession.previous,sync.previous);
 asyncSession.reset(789);assert.deepEqual(asyncSession.run,new GameSession({seed:789}).run);
});
test('cooperative startup yields between slices and propagates failures',async()=>{
 let yields=0;
 const result=await finishStartupAsync((function*(){yield;yield;return 42;})(),async()=>{yields++;},{sliceMilliseconds:0});
 assert.equal(result,42);assert.equal(yields,3);
 await assert.rejects(finishStartupAsync((function*(){yield;throw new Error('placement failed');})(),async()=>{}),/placement failed/);
});
