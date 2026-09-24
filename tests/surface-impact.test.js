import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {surfaceImpact} from '../src/simulation/surface-impact.js';
import {SurfaceImpacts,SURFACE_IMPACT} from '../src/rendering/surface-impacts.js';
import {DEFAULT_WORLD} from '../src/levels/scenario.js';
test('wall impacts use exact contact point and outward face normal',()=>{
 const wall=DEFAULT_WORLD.WALLS[0],edge=wall.edges[0];
 const x=(edge.a.x+edge.b.x)/2,s=(edge.a.s+edge.b.s)/2;
 const a={x:x+edge.nx*2,s:s+edge.ns*2,y:10},b={x:x-edge.nx*2,s:s-edge.ns*2,y:10};
 const hit=surfaceImpact(DEFAULT_WORLD,a,b);assert.ok(hit);
 assert.ok(Math.hypot(hit.x-x,hit.s-s)<1e-6);
 assert.ok(Math.abs(hit.normal.x-edge.nx)<1e-6);assert.ok(Math.abs(hit.normal.z+edge.ns)<1e-6);
});
test('floor collision chooses nearest surface and gives upward normal',()=>{
 const hit=surfaceImpact({wallIntersection:()=>.9},{x:0,y:1,s:0},{x:2,y:-1,s:0});
 assert.equal(hit.x,1);assert.equal(hit.y,0);assert.deepEqual(hit.normal,{x:0,y:1,z:0});
 assert.equal(surfaceImpact({wallIntersection:()=>null},{x:0,y:1,s:0},{x:2,y:1,s:0}),null);
});
test('impact rings align, offset, pause, expire, and clear resources',()=>{
 const scene=new THREE.Scene(),effects=new SurfaceImpacts(scene),normal=new THREE.Vector3(1,0,0);
 effects.spawn({x:10,y:2,s:5,normal});
 const effect=effects.effects[0].effect;
 assert.ok(effect.mesh.position.distanceTo(new THREE.Vector3(10+SURFACE_IMPACT.offsetMeters,2,-5))<1e-6);
 assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(effect.mesh.quaternion).distanceTo(normal)<1e-6);
 effects.update(.2);effects.update(0);assert.equal(effect.mesh.material.uniforms.age.value,.2);
 let disposed=false;effect.mesh.geometry.addEventListener('dispose',()=>disposed=true);
 effects.update(1);assert.equal(effects.effects.length,0);assert.equal(scene.children.length,0);assert.ok(disposed);
 effects.spawn({x:0,y:0,s:0,normal});effects.clear();assert.equal(scene.children.length,0);
});
test('vehicle effects attach to model face, not camera plane',()=>{
 const scene=new THREE.Scene(),effects=new SurfaceImpacts(scene),box=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());
 effects.spawn({x:.9,y:0,s:0,shotFrom:{x:2,y:0,z:0}},box);
 assert.equal(effects.effects.length,1);assert.ok(Math.abs(effects.effects[0].effect.mesh.position.x-1-SURFACE_IMPACT.offsetMeters)<1e-6);
 effects.dispose();box.geometry.dispose();box.material.dispose();
});
test('player and enemy rounds emit one wall effect and are consumed',async()=>{
 const {createRun,updateWeapons}=await import('../src/simulation/run.js');
 const edge=DEFAULT_WORLD.WALLS[0].edges[0],x=(edge.a.x+edge.b.x)/2,s=(edge.a.s+edge.b.s)/2;
 for(const faction of [undefined,'enemy']){
  const run=createRun(1982);run.recognizers=[];run.enemyTanks=[];
  run.projectiles=[{x:x+edge.nx*2,s:s+edge.ns*2,y:10,vx:-edge.nx*330,vs:-edge.ns*330,vy:0,life:1,faction}];
  updateWeapons(run,{},.02);assert.equal(run.projectiles.length,0);
  assert.equal(run.events.filter(e=>e.subject==='surface').length,1);
 }
});
