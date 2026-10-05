import test from 'node:test';
import assert from 'node:assert/strict';
import {resetCycleRound,updateCycleRace} from '../src/simulation/light-cycles.js';
import {LIGHT_CYCLES as C} from '../src/game/light-cycles.js';
import {ARENA_WALL} from '../src/game/arena-breaches.js';
import {rebuildTrailOccupancy} from '../src/simulation/cycle-trails.js';
import {sweepCycleSegment} from '../src/simulation/cycle-continuous.js';
const fixture=()=>{
 const r={site:{x:0,s:0},time:0,seed:1982,round:0,scores:[0,0],playerId:0};resetCycleRound(r);r.phase='racing';r.occupied.fill(0);r.trails=[];
 for(const b of r.cycles)Object.assign(b,{x:b.id*10,previousX:b.id*10,z:0,previousZ:0,nextReactionAt:Infinity});
 return r;
};
test('player turns on the very next step at fractional coordinates at cruise and braking speeds',()=>{
 for(const speedMultiplier of [1,.5,2.5]){
  const r=fixture(),b=r.cycles[0];Object.assign(b,{x:.37,previousX:.37,z:.23,previousZ:.23,speedMultiplier});
  updateCycleRace(r,1/120,1);
  assert.equal(b.dir,1);assert.equal(b.z,.23);assert(Math.abs(b.x-(.37+speedMultiplier*8/120))<1e-9);assert(b.alive);
  const corner=r.trails[b.segment];assert.equal(corner.x1,.37);assert.equal(corner.z1,.23);
 }
});
test('turning away just before an arena wall does not hit a reserved future grid cell',()=>{
 const r=fixture(),b=r.cycles[0],x=(ARENA_WALL.innerMeters-ARENA_WALL.cycleRadiusMeters-.1)/C.cellMeters;
 Object.assign(b,{x,previousX:x,z:.37,previousZ:.37,dir:1});
 updateCycleRace(r,1/120,-1);assert(b.alive);assert.equal(b.dir,0);assert.equal(b.x,x);
});
test('fractional trail crossings are swept at turbo speed and damage the actual contact point',()=>{
 const r=fixture(),b=r.cycles[0];Object.assign(b,{speedMultiplier:2.5});
 r.trails=[{bikeId:3,team:1,dir:1,x1:-2,z1:-.43,x2:2,z2:-.43}];
 updateCycleRace(r,.1,0,true);
 assert(!b.alive);assert(Math.abs(b.z-(-.43+ARENA_WALL.cycleRadiusMeters/C.cellMeters))<1e-8);
 assert.equal(r.crashes.filter(c=>c.id===0).length,1);
 assert(r.trails.some(t=>t.bikeId===3&&t.dyingAt!==undefined));
});
test('swept collision catches diagonal segment end caps without false distant contacts',()=>{
 assert(sweepCycleSegment({x:-1,z:0},{x:1,z:0},{x:0,z:.1},{x:1,z:1}));
 assert.equal(sweepCycleSegment({x:-1,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:2}),null);
});
test('head-on moving cycles crash together regardless of proposal order',()=>{
 for(const reverse of [false,true]){
  const r=fixture();r.cycles=r.cycles.filter(b=>b.id===0||b.id===3);
  const [a,b]=r.cycles;Object.assign(a,{x:-.3,previousX:-.3,dir:1,speedMultiplier:2.5});Object.assign(b,{x:.3,previousX:.3,dir:3,speedMultiplier:2.5});
  if(reverse)r.cycles.reverse();updateCycleRace(r,.03);assert(r.cycles.every(c=>!c.alive));assert.equal(r.crashes.length,2);
 }
});
test('AI decisions wait for their reaction interval and may turn off the grid',()=>{
 const r=fixture(),b=r.cycles[1];Object.assign(b,{x:0,previousX:0,z:5.37,previousZ:5.37,dir:1,nextReactionAt:.15});
 r.trails=[{bikeId:3,team:1,dir:0,x1:2,z1:3,x2:2,z2:8}];rebuildTrailOccupancy(r,[r.cycles[3]]);
 updateCycleRace(r,.1);assert.equal(b.dir,1);
 updateCycleRace(r,.06);assert.notEqual(b.dir,1);assert(Math.abs(b.previousX-Math.round(b.previousX))>.01);
 const dir=b.dir,next=b.nextReactionAt;updateCycleRace(r,.05);assert.equal(b.dir,dir);assert.equal(b.nextReactionAt,next);
});
test('full and fractional own trails remain collidable after corners',()=>{
 const r=fixture(),b=r.cycles[0];Object.assign(b,{x:.37,previousX:.37,z:.23,previousZ:.23});
 updateCycleRace(r,.25);updateCycleRace(r,.25,1);updateCycleRace(r,.25,1);updateCycleRace(r,.25,1);
 assert(!b.alive);assert.equal(r.crashes.filter(c=>c.id===0).length,1);
});
