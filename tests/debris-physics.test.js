import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {DebrisPhysics,debrisPhysicsReady} from '../src/rendering/debris-physics.js';
await debrisPhysicsReady;
function piece(dimensions=[2,2,2]){
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(...dimensions)));
 return {group,velocity:new T.Vector3(),spin:new T.Vector3()};
}
function wall(points,height=10){return {height,edges:points.map((a,i)=>({a,b:points[(i+1)%points.length]}))};}
const slab=wall([{x:0,s:-10},{x:1,s:-10},{x:1,s:10},{x:0,s:10}]);
function simulate(p,seconds,gravity=14.7,walls=[]){
 const physics=new DebrisPhysics(()=>walls);physics.add(p,gravity);
 for(let i=0;i<Math.round(seconds*120);i++)physics.update(1/120);
 return physics;
}
test('tilted blocks fall onto their broad face and sleep',()=>{
 const p=piece([3,10,2]);p.group.position.y=18;p.group.rotation.z=.6;p.spin.set(1,.2,.7);
 const physics=simulate(p,20);
 try{p.group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(p.group);
 assert.ok(bounds.min.y>-.03);assert.ok(bounds.min.y<.03);assert.ok(bounds.max.y<3.1);assert.equal(p.sleeping,true);
 const before=p.group.position.clone();physics.update(.1);assert.deepEqual(p.group.position,before);
 }finally{physics.dispose();}
});
test('fast box bounces off thin wall',()=>{
 const p=piece();p.group.position.set(-8,5,0);p.velocity.x=108;
 const physics=simulate(p,.1,0,[slab]);try{assert.ok(p.group.position.x<=-0.98);assert.ok(p.velocity.x<0);}finally{physics.dispose();}
});
test('roof supports debris',()=>{
 const broad=wall([{x:-20,s:-20},{x:20,s:-20},{x:20,s:20},{x:-20,s:20}]);
 const p=piece([4,6,4]);p.group.position.y=20;p.velocity.y=-80;
 const physics=simulate(p,15,14.7,[broad]);try{p.group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(p.group);assert.ok(Math.abs(bounds.min.y-10)<.03,`roof bottom ${bounds.min.y}`);assert.equal(p.sleeping,true);}finally{physics.dispose();}
});
test('debris above wall flies freely',()=>{
 const p=piece();p.group.position.set(-8,15,0);p.velocity.x=108;
 const physics=simulate(p,.1,0,[slab]);try{assert.ok(p.group.position.x>1);assert.ok(p.velocity.x>100);}finally{physics.dispose();}
});
test('airborne rotation retains momentum',()=>{
 const p=piece([2,2,2]);p.group.position.y=100;p.spin.y=2;
 const physics=simulate(p,2,0);try{assert.ok(p.spin.y>1.8);assert.ok(p.group.quaternion.angleTo(new T.Quaternion())>1);}finally{physics.dispose();}
});
test('off-center wall contact generates rotation without initial spin',()=>{
 const p=piece([2,6,2]);p.group.position.set(-8,5,0);p.group.rotation.z=.45;p.velocity.x=40;
 const physics=simulate(p,.3,0,[slab]);try{assert.ok(p.spin.length()>.5,`spin ${p.spin.length()}`);}finally{physics.dispose();}
});
test('debris does not collide with debris and removal releases bodies',()=>{
 const physics=new DebrisPhysics();
 const a=piece(),b=piece();a.group.position.set(-3,10,0);b.group.position.set(3,10,0);a.velocity.x=10;b.velocity.x=-10;
 physics.add(a,0);physics.add(b,0);
 try{for(let i=0;i<120;i++)physics.update(1/120);assert.ok(a.group.position.x>b.group.position.x);physics.clear();assert.equal(physics.world.bodies.len(),0);assert.equal(physics.pieces.size,0);}finally{physics.dispose();}
});

test('vehicle impact reports relative energy once, including mass',()=>{
 const shoot=(speed,size=2,targetSpeed=0)=>{
  const physics=new DebrisPhysics(),p=piece([size,size,size]);p.group.position.set(-8,10,0);p.velocity.x=speed;
  physics.syncVehicles([{key:'clu',x:0,y:10,z:0,yaw:0,velocity:{x:targetSpeed,y:0,z:0},boxes:[{center:[0,0,0],half:[1,2,2]}]}]);physics.add(p,0);
  try{let impacts=[];for(let i=0;i<120;i++){physics.update(1/120);impacts.push(...physics.drainImpacts());}return impacts;}finally{physics.dispose();}
 };
 const hit=shoot(30);assert.equal(hit.length,1,JSON.stringify(hit));assert.ok(hit[0].energy>150000,JSON.stringify(hit));
 assert.equal(shoot(8,1).length,0);assert.equal(shoot(30,2,30).length,0);
 assert.ok(shoot(40)[0].energy>hit[0].energy*1.5);
 assert.ok(shoot(120)[0].energy>hit[0].energy*10);
 assert.ok(shoot(30,1)[0].energy<hit[0].energy/6);
});
