import test from 'node:test';
import assert from 'node:assert/strict';
import {attachWorld} from '../src/levels/scenario.js';
import {turretSegment,turretWallContact,tankContactPose,resolveTurretMotion,holdLodgedTurret,damageWallFromTank,TURRET_CONTACT} from '../src/simulation/turret-collision.js';
const wall={height:30,points:[{x:-100,s:0},{x:100,s:0},{x:100,s:100},{x:-100,s:100}]};
const world={nearbyWalls:()=>[wall],insideWall:(_w,_x,s)=>s>=0,closestWallPoint:(_w,x,s)=>({x,s:0,nx:0,ns:-1,distance:Math.abs(s)})};
const tank=()=>attachWorld({x:0,s:-8,yaw:0,turretYaw:0,speed:0,steer:0,time:1,impact:0,events:[]},world);
test('barrel measurements match muzzle and pivot; no collision in free space',()=>{
 const r=tank(),[a,b]=turretSegment(r);assert(Math.abs(b.s-(-8+5.860956431927108))<1e-9);assert(a.s<b.s);assert.equal(turretWallContact(world,r),null);
});
test('slow barrel impact stops before penetrating, without damage or lodging',()=>{
 const r=tank(),before=tankContactPose(r);r.s=-3;
 assert(resolveTurretMotion(r,before,1));assert.equal(turretWallContact(world,r),null);assert.equal(r.events.length,0);assert(!r.barrelJam);
 const stopped=r.s;const retreat=tankContactPose(r);r.s-=1;assert(!resolveTurretMotion(r,retreat,.1));assert(r.s<stopped);
});
test('high speed muzzle impact damages the wall and lodges the barrel',()=>{
 const r=tank(),before=tankContactPose(r);r.s=-3;
 assert(resolveTurretMotion(r,before,.05));assert(r.barrelJam);assert(r.events.some(e=>e.subject==='surface'));assert.equal(r.speed,0);
 const stuck=r.s;holdLodgedTurret(r,{throttle:1},1);assert.equal(r.s,stuck);
 holdLodgedTurret(r,{throttle:-1},TURRET_CONTACT.extractSeconds/2);assert(r.s<stuck);assert(r.barrelJam);
 holdLodgedTurret(r,{throttle:-1},TURRET_CONTACT.extractSeconds/2);assert.equal(r.barrelJam,null);assert.equal(turretWallContact(world,r),null);
});
test('turret rotation cannot sweep through a wall even if the final pose is clear',()=>{
 const r=tank();r.s=-4;r.turretYaw=-Math.PI/2;const before=tankContactPose(r);r.turretYaw=Math.PI/2;
 assert(resolveTurretMotion(r,before,2));assert(r.turretYaw<0);assert.equal(turretWallContact(world,r),null);assert(!r.barrelJam);
});
test('wall impacts are speed gated and rate limited',()=>{
 const r=tank(),contact={x:0,s:0,y:1,normal:{x:0,y:0,z:1}};
 damageWallFromTank(r,contact,20);assert.equal(r.events.length,0);
 damageWallFromTank(r,contact,45);damageWallFromTank(r,contact,45);assert.equal(r.events.length,1);
 r.time+=1;damageWallFromTank(r,contact,45);assert.equal(r.events.length,2);
});
test('reset state does not inherit a lodged barrel',async()=>{
 const {createRun}=await import('../src/simulation/run.js');assert.equal(createRun(1982).barrelJam,null);
});

test('a turbo-speed hull impact emits wall damage without a barrel jam',async()=>{
 const {moveTank}=await import('../src/simulation/run.js');const r=tank();r.s=-5;r.speed=50;r.enemyTanks=[];
 assert(moveTank(r,0,4));assert(r.events.some(e=>e.subject==='surface'&&e.source==='tank-impact'));assert(!r.barrelJam);
});
