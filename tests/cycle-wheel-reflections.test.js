import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceWheelReflection as advance} from '../src/rendering/cycle-wheel-reflections.js';
test('wheel cadence scales with speed and is independent of display frame rate',()=>{
 const run=(fps,speed)=>{let s=advance(null,0,speed);for(let i=1;i<=fps;i++)s=advance(s,i/fps,speed);return s;};
 for(const fps of [24,60,120]){assert(Math.abs(run(fps,38.4).phase-12)<1e-8);assert(Math.abs(run(fps,19.2).phase-6)<1e-8);assert(Math.abs(run(fps,96).phase-24)<1e-8);}
});
test('stationary discs have no glint and paused simulation time freezes the phase',()=>{
 const s=advance(advance(null,0,38.4),.1,38.4);
 assert.equal(advance(s,.1,38.4).phase,s.phase);
 assert.equal(advance(s,.2,0).strength,0);
 assert.equal(advance(s,.2,0).phase,s.phase);
 assert.equal(advance(null,0,1).strength,.5);
});
