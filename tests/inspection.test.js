import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,updateWeapons} from '../src/simulation/run.js';
import {resolveCrush} from '../src/simulation/crush.js';
import {applyDebrisImpacts} from '../src/simulation/debris-damage.js';
function setup(){const r=createRun(1982);r.x=10000;r.s=10000;r.enemyTanks=[];r.recognizers=[];r.inspection=true;return r;}
test('inspection consumes bullets without damage, then restores normal damage',()=>{
 const r=setup();
 const shoot=()=>{r.projectiles=[{faction:'enemy',owner:100,x:r.x,s:r.s,y:2,vx:0,vs:0,vy:0,life:1}];updateWeapons(r,{},1/60);};
 shoot();assert.equal(r.health,3);assert(!r.crushed);assert.equal(r.projectiles.length,0);
 r.inspection=false;shoot();assert.equal(r.health,2);
});
test('inspection blocks lethal debris without changing enemy damage',()=>{
 const r=setup(),hit={target:'clu',energy:1000000,point:{x:r.x,y:2,z:-r.s}};
 applyDebrisImpacts(r,[hit]);assert.equal(r.health,3);assert(!r.crushed);
 r.inspection=false;applyDebrisImpacts(r,[hit]);assert(r.crushed);
});
test('inspection prevents stomps from destroying Clu; leaving restores stomps',()=>{
 const r=setup(),e={x:r.x,s:r.s,attack:{impact:true}};
 resolveCrush(r,e);assert(!r.crushed);assert(!r.events.some(e=>e.type==='destroyed'));
 r.inspection=false;e.attack.impact=true;resolveCrush(r,e);assert(r.crushed);
});

test('spectator J/L and I/K smoothly steer both camera axes',async()=>{
 const {PerspectiveCamera}=await import('three');const {FreeCamera,SPECTATOR_CAMERA}=await import('../src/rendering/free-camera.js');
 for(const [key,axis,sign] of [['KeyJ','y',1],['KeyL','y',-1],['KeyI','x',1],['KeyK','x',-1]]){
  const c=new FreeCamera(new PerspectiveCamera());c.enter({spectator:true});
  c.update(1/60,new Set([key]));const first=c.rotation[axis]*sign;
  assert(first>0&&first<SPECTATOR_CAMERA.keyboardRadiansPerSecond/60);
  for(let i=0;i<30;i++)c.update(1/60,new Set([key]));assert(c.rotation[axis]*sign>first*10);
  const speed=c.lookVelocity.length();c.update(1/60,new Set());assert(c.lookVelocity.length()<speed);
  c.exit();assert.equal(c.lookVelocity.length(),0);
 }
});
test('post-death movement is slower and eases to a stop; inspection keeps its original speed',async()=>{
 const {PerspectiveCamera}=await import('three');const {FreeCamera}=await import('../src/rendering/free-camera.js');
 const spectator=new FreeCamera(new PerspectiveCamera()),inspection=new FreeCamera(new PerspectiveCamera());
 spectator.enter({spectator:true});inspection.enter();
 const keys=new Set(['KeyW']);for(let i=0;i<60;i++){spectator.update(1/60,keys);inspection.update(1/60,keys);}
 assert(Math.abs(spectator.camera.position.z)>25&&Math.abs(spectator.camera.position.z)<36);
 assert(Math.abs(inspection.camera.position.z+180)<1e-8);
 const before=spectator.camera.position.z,speed=spectator.velocity.length();spectator.update(1/60,new Set());
 assert(spectator.camera.position.z<before);assert(spectator.velocity.length()<speed);
 spectator.exit();assert.equal(spectator.velocity.length(),0);
});
