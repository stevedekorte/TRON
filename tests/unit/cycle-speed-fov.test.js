import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleSpeedFovPosition} from '../../src/rendering/cycle-speed-fov.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
import {ROAD_CYCLE} from '../../shared/simulation/config/cycle-road.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test('arena: position follows actual speed between the minimum and maximum at the grid speed',()=>{
  for(const grid of [1,2,4]){
    const at=ratio=>cycleSpeedFovPosition({speedMultiplier:grid*ratio,gridSpeedMultiplier:grid});
    near(at(1),0);                               // cruise
    near(at(C.slowSpeedMultiplier),-1);          // minimum: grid × slow
    near(at(C.turboSpeedMultiplier),1);          // maximum: grid × turbo
    near(at((1+C.turboSpeedMultiplier)/2),.5);   // halfway up
    near(at((1+C.slowSpeedMultiplier)/2),-.5);   // halfway down
  }
});

test('arena: clamped outside the range, and a rising grid speed alone does not move it',()=>{
  near(cycleSpeedFovPosition({speedMultiplier:10,gridSpeedMultiplier:1}),1);
  near(cycleSpeedFovPosition({speedMultiplier:.1,gridSpeedMultiplier:1}),-1);
  near(cycleSpeedFovPosition({speedMultiplier:2,gridSpeedMultiplier:2}),0);   // cruising at 2× arena speed
  near(cycleSpeedFovPosition({speedMultiplier:1,gridSpeedMultiplier:2}),-1);  // 2× arena speed: braking floor is 1× base
  near(cycleSpeedFovPosition(undefined),0);
});

test('road: cruise to turbo speed limit; slower than cruise is 0',()=>{
  const c=ROAD_CYCLE,mid=(c.maxSpeedMetersPerSecond+c.turboMaxSpeedMetersPerSecond)/2;
  near(cycleSpeedFovPosition({escaped:true,roadSpeed:c.maxSpeedMetersPerSecond}),0);
  near(cycleSpeedFovPosition({escaped:true,roadSpeed:c.turboMaxSpeedMetersPerSecond}),1);
  near(cycleSpeedFovPosition({escaped:true,roadSpeed:-mid}),.5);
  near(cycleSpeedFovPosition({escaped:true,roadSpeed:0}),0);
});
