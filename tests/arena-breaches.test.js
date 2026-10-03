import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {tickCycleRace,resetCycleRound} from '../src/simulation/light-cycles.js';
import {cutBreachGeometry} from '../src/rendering/arena-breaches.js';
import {arenaWallBlocked} from '../src/game/arena-breaches.js';
const race=()=>{const r={time:0,seed:1982,scores:[0,0],round:0};resetCycleRound(r);r.phase='racing';return r;};
test('wall crash opens a persistent gap; following cycle passes through and survives outside',()=>{
 const r=race(),b=r.cycles[0];Object.assign(b,{x:85,z:0,previousX:84,previousZ:0,dir:1});
 tickCycleRace(r,()=>1,[b]);assert(!b.alive);assert.equal(r.breaches.length,1);
 r.occupied[(86)*173+85+86]=b.id+1;
 const follower=r.cycles[1];Object.assign(follower,{x:85,z:1,dir:1});
 for(let i=0;i<16;i++)tickCycleRace(r,()=>1,[follower]);
 assert(follower.alive);assert(follower.escaped);assert.equal(follower.x,98);
 assert(arenaWallBlocked(r,90,5));assert(!arenaWallBlocked(r,90,0));
 resetCycleRound(r);assert.equal(r.breaches.length,1);assert(!arenaWallBlocked(r,90,0));
});
test('cut mesh admits a ray through the opening but retains adjacent wall geometry',()=>{
 const geometry=new T.PlaneGeometry(100,60);geometry.translate(0,30,411);
 const cut=cutBreachGeometry(geometry,new T.Matrix4(),{axis:'z',sign:1,along:0});
 const mesh=new T.Mesh(cut,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 const hits=(x,y=1)=>new T.Raycaster(new T.Vector3(x,y,400),new T.Vector3(0,0,1)).intersectObject(mesh).length;
 assert.equal(hits(0),0);assert(hits(15)>0);
 assert.equal(hits(3,40),0);assert.equal(hits(-8,20),0);assert(hits(15,40)>0);
 geometry.dispose();cut.dispose();mesh.material.dispose();
});

test('arena outlines discard coplanar T-junction seams but preserve corners',async()=>{
 const {arenaEdges}=await import('../src/rendering/arena-edges.js');
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([
  0,0,0, 2,0,0, 1,1,0,
  2,0,0, 2,2,0, 1,1,0,
  0,0,0, 2,2,0, 0,2,0,
 ],3));
 const edges=arenaEdges(g,20),p=edges.attributes.position;
 let length=0;for(let i=0;i<p.count;i+=2)length+=new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(p,i+1));
 assert(Math.abs(length-8)<1e-6);
 const box=new T.BoxGeometry(2,2,2),corners=arenaEdges(box,20);
 assert.equal(corners.attributes.position.count,24);
 for(const geometry of [g,edges,box,corners])geometry.dispose();
});

test('arena damage survives session resets but a new app session starts intact',async()=>{
 const {GameSession}=await import('../src/simulation/game-session.js');
 const {browserScenario}=await import('../src/game/browser-scenario.js');
 const {world}=browserScenario({pathname:'/',search:'?layoutSeed=1982'});
 const session=new GameSession({world});
 const breach={axis:'x',sign:1,along:0,id:0,time:2};session.run.cycleRace.breaches.push(breach);
 for(let i=0;i<3;i++){
  session.reset();assert.deepEqual(session.run.cycleRace.breaches,[breach]);
  resetCycleRound(session.run.cycleRace);assert(!arenaWallBlocked(session.run.cycleRace,90,0));
 }
 const fresh=new GameSession({world});assert.deepEqual(fresh.run.cycleRace.breaches,[]);assert(arenaWallBlocked(fresh.run.cycleRace,90,0));
 session.dispose();fresh.dispose();
});
