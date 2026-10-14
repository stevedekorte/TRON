import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CycleRendererGuard} from '../../src/rendering/cycle-renderer-guard.js';
const feed=(guard,fps,seconds,active=true)=>{let trips=0;for(let i=0;i<fps*seconds;i++)trips+=Number(guard.sample(1/fps,active));return trips;};
test('sustained slow play falls back exactly once, without automatic retries',()=>{const g=new CycleRendererGuard();assert.equal(feed(g,25,12),1);assert.equal(feed(g,25,60),0);assert.equal(feed(g,60,60),0);});
test('normal play and brief slow bursts do not downgrade',()=>{const g=new CycleRendererGuard();assert.equal(feed(g,60,30),0);assert.equal(feed(g,25,3),0);assert.equal(feed(g,60,4),0);assert.equal(feed(g,25,3),0);assert.equal(feed(g,60,30),0);});
test('loading, inactive windows, pauses and resume warmup are excluded',()=>{const g=new CycleRendererGuard();assert.equal(feed(g,10,60,false),0);assert.equal(feed(g,25,8),0);g.sample(5,true);assert.equal(feed(g,25,8),0);g.sample(.05,false);assert.equal(feed(g,25,8),0);});
test('manual retry starts a fresh guarded attempt',()=>{const g=new CycleRendererGuard();assert.equal(feed(g,20,12),1);g.reset();assert.equal(feed(g,60,30),0);assert.equal(feed(g,20,8),1);});
