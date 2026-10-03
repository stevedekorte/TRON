import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {resetCycleRound,tickCycleRace,cycleCellFree} from '../src/simulation/light-cycles.js';
import {damageCycleTrail,expireDamagedTrails} from '../src/simulation/cycle-trail-damage.js';
import {rebuildTrailOccupancy} from '../src/simulation/cycle-trails.js';
import {LIGHT_CYCLES as C} from '../src/game/light-cycles.js';
import {LightCycleWalls} from '../src/rendering/light-cycle-walls.js';
const fixture=()=>{
 const r={time:10,seed:1982,round:0,scores:[0,0]};resetCycleRound(r);r.phase='racing';r.occupied.fill(0);r.trails=[];
 Object.assign(r.cycles[0],{x:10,z:0,previousX:10,previousZ:0,segment:0});
 r.trails=[{bikeId:0,team:0,dir:1,x1:-10,z1:0,x2:10,z2:0}];rebuildTrailOccupancy(r,[r.cycles[0]]);return r;
};
test('collision punches a two-width gap and only the older struck trail decays',()=>{
 const r=fixture(),b=r.cycles[3];Object.assign(b,{x:0,z:-1,dir:2});
 tickCycleRace(r,()=>2,[b]);assert(!b.alive);assert(r.cycles[0].alive);
 const [old,recent]=r.trails;assert.equal(old.dyingAt,10);assert.equal(recent.dyingAt,undefined);
 assert(Math.abs((recent.x1-old.x2)*C.cellMeters-2*C.trailImpactHalfGapMeters)<1e-8);
 assert.equal(r.cycles[0].segment,1);assert(cycleCellFree(r,0,0));assert(!cycleCellFree(r,-2,0));assert(!cycleCellFree(r,2,0));
 const walls=new LightCycleWalls(new T.Group());r.time=13.59;walls.update(r,1);
 const matrix=new T.Matrix4(),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion();let lower=false,full=false;
 for(let i=0;i<walls.meshes[0].count;i++){walls.meshes[0].getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);lower||=Math.abs(scale.y-C.trailHeightMeters*.5)<1e-5;full||=Math.abs(scale.y-C.trailHeightMeters)<1e-5;}
 assert(lower&&full);expireDamagedTrails(r);assert(!cycleCellFree(r,-2,0));
 r.time=14;expireDamagedTrails(r);assert.equal(r.trails.length,1);assert.equal(r.cycles[0].segment,0);assert(cycleCellFree(r,-2,0));assert(!cycleCellFree(r,2,0));
 for(const mesh of walls.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});
test('gap spans a corner and removes complete tiny segments without reconnecting the owner trail',()=>{
 const r=fixture();r.trails=[{bikeId:0,team:0,x1:-10,z1:0,x2:0,z2:0},{bikeId:0,team:0,x1:0,z1:0,x2:0,z2:.1}];r.cycles[0].segment=1;
 assert(damageCycleTrail(r,0,0,0));assert.equal(r.trails.length,1);assert.equal(r.cycles[0].segment,-1);assert(r.trails[0].dyingAt!==undefined);
});
test('a repeated strike does not restart the older section death timer',()=>{
 const r=fixture();damageCycleTrail(r,0,2,0);r.time=11;damageCycleTrail(r,0,-2,0);
 assert(r.trails.filter(t=>t.dyingAt!==undefined).every(t=>t.dyingAt===10));
 assert(r.trails.some(t=>t.dyingAt===undefined));
});
test('a road-mode cycle impact also splits the struck trail',async()=>{
 const {enterRoadMode}=await import('../src/simulation/cycle-road.js');
 const {updateCycleRace}=await import('../src/simulation/light-cycles.js');
 const r=fixture();r.site={x:0,s:0};r.playerId=3;
 r.trails[0].x1+=120;r.trails[0].x2+=120;r.cycles[0].x+=120;rebuildTrailOccupancy(r,[r.cycles[0]]);
 const b=r.cycles[3];Object.assign(b,{x:120,z:-1,previousX:120,previousZ:-1,dir:2});enterRoadMode(b);b.roadSpeed=40;b.targetRoadSpeed=40;
 updateCycleRace(r,.2,0,false,false,{});
 assert(r.trails.some(t=>t.dyingAt!==undefined));assert(cycleCellFree(r,120,0));
});
