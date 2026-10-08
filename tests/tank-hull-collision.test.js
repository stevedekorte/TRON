import test from 'node:test';
import assert from 'node:assert/strict';
import {attachWorld} from '../src/levels/scenario.js';
import {TANK_HULL,tankHullPoints,tankHullContact,constrainHullTurn} from '../src/simulation/tank-hull-collision.js';
import {moveTank} from '../src/simulation/run.js';
const wall={height:30,points:[{x:-100,s:0},{x:100,s:0},{x:100,s:100},{x:-100,s:100}]};
const world={nearbyWalls:()=>[wall],insideWall:(_w,_x,s)=>s>=0,closestWallPoint:(_w,x,s)=>({x,s:0,nx:0,ns:-1,distance:Math.abs(s)})};
const tank=(yaw=0)=>attachWorld({x:0,s:-10,yaw,speed:50,time:1,impact:0,events:[],enemyTanks:[]},world);
test('long hull corners collide where the old 3.5 metre circle was clear',()=>{
 const r=tank();r.s=-4;assert(tankHullContact(r));assert(TANK_HULL.halfLengthMeters>4.68);
});
test('swept hull translation protects every corner at different headings and turbo displacement',()=>{
 for(const yaw of [0,.2,.7,1.2,Math.PI/2,Math.PI]){
  const r=tank(yaw);assert(moveTank(r,0,40));
  assert(tankHullPoints(r).every(p=>p.s<.00001),`corner crosses wall at yaw ${yaw}`);assert.equal(tankHullContact(r),null);
  const before=r.s;moveTank(r,2,-2);assert(r.s<before,'reverse remains available');
 }
});
test('turning in place stops the hull corners at the wall',()=>{
 const r=tank(Math.PI/2);r.s=-3.5;assert.equal(tankHullContact(r),null);
 r.yaw=0;assert(constrainHullTurn(r,Math.PI/2));assert(r.yaw>0);assert.equal(tankHullContact(r),null);
});
test('hull retains tangential movement on wall contact',()=>{
 const r=tank();r.s=-TANK_HULL.halfLengthMeters-.01;moveTank(r,4,2);assert(Math.abs(r.x-4)<1e-6);assert.equal(tankHullContact(r),null);
});
