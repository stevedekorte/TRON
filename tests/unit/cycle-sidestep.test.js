import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleSidestep,headingAfter} from '../../src/app/cycle-sidestep.js';
import {GamepadController} from '../../src/app/gamepad-controller.js';
import {InputController} from '../../src/app/input-controller.js';

const ok={eligible:true,valid:true,round:3,dir:1};
test('Q turns left on press and right on release, locking the starting heading',()=>{
 const s=new CycleSidestep();
 assert.equal(s.press('KeyQ',ok),-1);assert.equal(s.lockYaw,-Math.PI/2);
 assert.equal(s.update(new Set(['KeyQ']),ok),0);assert.equal(s.lockYaw,-Math.PI/2);
 assert.equal(s.update(new Set(),ok),1);assert.equal(s.lockYaw,null);
 assert.equal(s.press('KeyE',ok),1);assert.equal(s.update(new Set(),ok),-1);
});
test('one sidestep at a time; the other key and ineligible presses are ignored',()=>{
 const s=new CycleSidestep();
 assert.equal(s.press('KeyE',{...ok,eligible:false}),0);assert.equal(s.press('KeyA',ok),0);
 s.press('KeyQ',ok);assert.equal(s.press('KeyE',ok),0);
 // Releasing E (never started) does nothing; only Q's release turns back.
 assert.equal(s.update(new Set(['KeyQ']),ok),0);assert.equal(s.update(new Set(['KeyE']),ok),1);
});
test('death, a new round or leaving the arena drop the sidestep without a return turn',()=>{
 for(const after of [{...ok,valid:false},{...ok,round:4}]){
  const s=new CycleSidestep();s.press('KeyQ',ok);
  assert.equal(s.update(new Set(['KeyQ']),after),0);assert.equal(s.lockYaw,null);
  assert.equal(s.update(new Set(),ok),0);
 }
});
test('heading counts the turns still queued',()=>{
 assert.equal(headingAfter(0,[-1]),3);assert.equal(headingAfter(3,[1,1]),1);assert.equal(headingAfter(2,[]),2);
});
test('the return turn is queued even when the two-turn queue is full',()=>{
 const input=new InputController();input.queueCycleTurn(-1,1);input.queueCycleTurn(1,1);assert.deepEqual(input.cycleTurns,[-1]);
 input.queueCycleTurn(1,1,true);assert.deepEqual(input.cycleTurns,[-1,1]);
});
test('LB/RB hold the sidestep keys in cycle play; RB still zooms otherwise',()=>{
 const pad={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};
 const g=new GamepadController();g.poll([pad]);
 pad.buttons[4].pressed=true;assert(g.poll([pad],{playing:true,cycle:true}).held.has('KeyQ'));
 pad.buttons[4].pressed=false;pad.buttons[5].pressed=true;const r=g.poll([pad],{playing:true,cycle:true});
 assert(r.held.has('KeyE'));assert(!r.pressed.includes('KeyO'));
 pad.buttons[5].pressed=false;g.poll([pad],{playing:true});pad.buttons[5].pressed=true;assert(g.poll([pad],{playing:true}).pressed.includes('KeyO'));
});
