import test from 'node:test';
import assert from 'node:assert/strict';
import {speechChunks,speakSentences,MCP_SPEECH_CHUNKS} from '../src/mcp/speech-queue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('short sentences begin separately, with punctuation preserved',()=>{
 assert.deepEqual(speechChunks('Greetings, User.  State your purpose!'),['Greetings, User.','State your purpose!']);
 assert.deepEqual(speechChunks(''),[]);
 const text=Array(45).fill('program').join(' ')+'.',chunks=speechChunks(text);
 assert.equal(chunks.join(' '),text);assert(chunks.every(c=>c.length<=MCP_SPEECH_CHUNKS.maxCharacters));
});
test('next sentence generates during playback, preserving ordered audio and a one-sentence buffer',async()=>{
 const playing=deferred(),started=deferred(),generated=[],played=[];
 const work=speakSentences({text:'First sentence. Second sentence. Third sentence.',isCurrent:()=>true,generate:async text=>{generated.push(text);return text;},play:async audio=>{played.push(audio);if(played.length===1){started.resolve();await playing.promise;}}});
 await started.promise;await Promise.resolve();
 assert.deepEqual(generated,['First sentence.','Second sentence.']);assert.deepEqual(played,['First sentence.']);
 playing.resolve();await work;assert.deepEqual(played,generated);
});
test('Escape discards prefetched speech, drains inference and never requests a later sentence',async()=>{
 let current=true;const next=deferred(),started=deferred(),playing=deferred(),generated=[],played=[];
 const work=speakSentences({text:'First. Second. Third.',isCurrent:()=>current,generate:text=>{generated.push(text);return text==='Second.'?next.promise:Promise.resolve(text);},play:async audio=>{played.push(audio);started.resolve();await playing.promise;}});
 await started.promise;await Promise.resolve();current=false;playing.resolve();let finished=false;work.then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);
 next.resolve('Second.');await work;assert.deepEqual(played,['First.']);assert.deepEqual(generated,['First.','Second.']);
});
test('prefetch errors are handled while audio plays and reported after it finishes',async()=>{
 const playing=deferred(),started=deferred();let completed=false;
 const work=speakSentences({text:'First. Second.',isCurrent:()=>true,generate:async text=>{if(text==='Second.')throw Error('inference failed');return text;},play:async()=>{started.resolve();await playing.promise;completed=true;}});
 const check=assert.rejects(work,/inference failed/);await started.promise;await Promise.resolve();assert.equal(completed,false);playing.resolve();await check;assert.equal(completed,true);
});
