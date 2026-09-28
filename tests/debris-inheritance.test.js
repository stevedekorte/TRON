import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Breakups} from '../src/rendering/breakup.js';
import {debrisPhysicsReady,DebrisPhysics} from '../src/simulation/debris-physics.js';
await debrisPhysicsReady;
test('explosion adds full vehicle velocity to each piece, and Rapier receives it',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial()));
 const still=new Breakups(new T.Scene()),moving=new Breakups(new T.Scene()),random=Math.random;
 try{
  Math.random=()=>.4;
  const event={x:0,y:100,s:0,yaw:.7,fold:0};
  still.spawn({root},event);moving.spawn({root},{...event,vx:45,vy:-12,vs:30});
  const a=still.bursts[0].pieces,b=moving.bursts[0].pieces;assert.equal(a.length,b.length);
  assert.ok([...a,...b].every(p=>p.gravity===9.81));
  for(let i=0;i<a.length;i++){
   assert.ok(b[i].velocity.clone().sub(a[i].velocity).distanceTo(new T.Vector3(45,-12,-30))<1e-8);
   moving.physics.activate(b[i]);assert.ok(new T.Vector3().copy(b[i].body.linvel()).distanceTo(b[i].velocity)<1e-4);
  }
 }finally{Math.random=random;still.dispose();moving.dispose();}
});
test('delayed sections keep moving before detaching',()=>{
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(2,2,2)));group.position.y=100;
 const p={group,delay:.1,velocity:new T.Vector3(50,0,0),inheritedVelocity:new T.Vector3(40,0,0),spin:new T.Vector3()};
 const physics=new DebrisPhysics();physics.add(p,0);
 try{
  physics.update(.05);assert.equal(p.body,undefined);assert.ok(Math.abs(group.position.x-2)<1e-6);
  physics.update(.075);assert.ok(p.body);assert.ok(group.position.x>4);assert.ok(p.body.linvel().x>49);
 }finally{physics.dispose();}
});

test('Recognizer pieces radiate from the hit point in world space, including vertically',()=>{
 const root=new T.Group();
 for(const x of [-4,4])for(const y of [-4,4]){
  const leg=new T.Group();leg.name=x<0?'left-leg':'right-leg';
  const mesh=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());mesh.position.set(x,y,0);leg.add(mesh);root.add(leg);
 }
 const random=Math.random;Math.random=()=>.4;
 const inherited=new T.Vector3(7,-2,-11),systems=[];
 try{
  for(const hit of [{x:95,y:100,z:20},{x:105,y:100,z:20},{x:100,y:105,z:20}]){
   const breakup=new Breakups(new T.Scene());systems.push(breakup);
   breakup.spawn({root},{subject:'recognizer',x:100,y:100,s:-20,yaw:Math.PI/2,hit,vx:7,vy:-2,vs:11});
   for(const piece of breakup.bursts[0].pieces){
    const radial=piece.group.position.clone().sub(new T.Vector3().copy(hit));
    const impulse=piece.velocity.clone().sub(inherited);
    assert(impulse.length()>0);assert(radial.dot(impulse)>0);
    assert(radial.normalize().distanceTo(impulse.normalize())<1e-8);
   }
  }
  const a=systems[0].bursts[0].pieces,b=systems[1].bursts[0].pieces;
  assert(a.every(p=>p.velocity.x>inherited.x));assert(b.every(p=>p.velocity.x<inherited.x));
  assert(systems[2].bursts[0].pieces.every(p=>p.velocity.y<inherited.y));
 }finally{Math.random=random;systems.forEach(s=>s.dispose());root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
});
