import test from 'node:test';
import {config} from '../src/game/config.js';
import assert from 'node:assert/strict';
import {createScenario} from '../src/levels/scenario.js';
import {createCycleRace,updateCycleRace,tickCycleRace} from '../src/simulation/light-cycles.js';
import {LIGHT_CYCLES as C,cycleTrailState} from '../src/game/light-cycles.js';
import {createRecognizers,updateRecognizers} from '../src/simulation/recognizers.js';
import {flyArenaPatrol,returningToArena} from '../src/simulation/arena-patrol.js';
import {createRun} from '../src/simulation/run.js';
const {world}=createScenario({layout:'blueprint',centralLabyrinth:true});
const race=()=>createCycleRace(world,1982);
test('six bikes, two equal teams, deterministic rounds with bounded trails',()=>{
 const a=race(),b=race();assert.equal(a.cycles.length,6);assert.equal(a.cycles.filter(c=>c.team===0).length,3);
 let completed=0;const expectedScores=[0,0];
 for(let n=0;n<180*60;n++){
  const previousPhase=a.phase;updateCycleRace(a,1/60);updateCycleRace(b,1/60);
  if(previousPhase==='racing'&&a.phase==='result'){
   completed++;
   const survivors=[0,1].map(team=>a.cycles.filter(c=>c.alive&&c.team===team).length);
   const winner=survivors[0]===survivors[1]?null:survivors[0]>survivors[1]?0:1;
   assert.equal(a.winner,winner);
   if(winner!==null)expectedScores[winner]++;
  }
 }
 assert.deepEqual(a,b);assert(a.round>1);assert(completed>0);assert.deepEqual(a.scores,expectedScores);assert(a.trails.length<6000);
 assert(a.cycles.every(c=>Math.abs(c.x)<=C.halfCells&&Math.abs(c.z)<=C.halfCells));
});
test('head-on same-cell collisions eliminate both independent of iteration order',()=>{
 for(const reverse of [false,true]){
  const r=race();r.occupied.fill(0);r.phase='racing';r.cycles=r.cycles.slice(0,2);
  Object.assign(r.cycles[0],{x:-1,z:0,dir:1,team:0});Object.assign(r.cycles[1],{x:1,z:0,dir:3,team:1});
  if(reverse)r.cycles.reverse();tickCycleRace(r,(_,b)=>b.dir);
  assert(r.cycles.every(b=>!b.alive));assert.equal(r.winner,null);assert.equal(r.phase,'result');
 }
});
test('walls and trail occupancy are solid to both teams',()=>{
 const r=race();r.phase='racing';r.cycles=r.cycles.slice(0,2);
 Object.assign(r.cycles[0],{x:C.halfCells,z:0,dir:1});
 Object.assign(r.cycles[1],{x:0,z:0,dir:0});
 r.occupied[(C.halfCells-1)*(2*C.halfCells+1)+C.halfCells]=1;
 tickCycleRace(r,(_,b)=>b.dir);assert(r.cycles.every(b=>!b.alive));
});
test('arena patrol completes the perimeter and leaves for confirmed enemy knowledge',()=>{
 const e=createRecognizers(()=>.5,world).find(e=>e.role==='arena-patrol');assert(e);
 const visited=new Set();
 for(let n=0;n<260*60;n++){flyArenaPatrol(e,n/60,1/60);visited.add(e.patrolWaypoint);assert(e.y>80);}
 assert.equal(visited.size,4);assert(returningToArena(e,260));
 e.memory={x:e.x+100,s:e.s,seenAt:260,vx:0,vs:0};assert(!returningToArena(e,260));assert(returningToArena(e,300));
});
test('arena patrol switches to local and tactical pursuit on a visible contact',()=>{
 for(const aiMode of ['classic','local']){
  const r=createRun(1982,world,{vehicle:{...config,aiMode}}),e=r.recognizers.find(e=>e.role==='arena-patrol');
  r.recognizers=[e];r.enemyTanks=[];r.x=e.x;r.s=e.s+100;r.speed=0;e.yaw=0;e.alertUntil=100;e.nextSense=0;
  r.time=1;for(let i=0;i<240&&!e.memory;i++){r.time+=1/60;updateRecognizers(r,1/60);}assert(e.memory);assert(!e.arenaPatrolling);assert.equal(e.state,'pursue');
 }
});

test('dead trails hold, flash, lower, then release only their own occupied cells',()=>{
 assert.deepEqual(cycleTrailState(2.99),{height:1,flash:0});
 assert.equal(cycleTrailState(3.12).flash,1);
 assert.equal(cycleTrailState(3.24).flash,0);
 assert(Math.abs(cycleTrailState(3.59).height-.5)<1e-8);
 assert.equal(cycleTrailState(3.94).height,0);
 const r=race();r.phase='result';r.remaining=10;r.occupied.fill(0);r.occupied[0]=1;r.occupied[1]=2;
 r.crashes=[{id:0,time:0}];updateCycleRace(r,3.5);assert.equal(r.occupied[0],1);
 updateCycleRace(r,.5);assert.equal(r.occupied[0],0);assert.equal(r.occupied[1],2);assert(r.crashes[0].trailCleared);
});

test('dead trail rendering lowers opaque geometry and removes it at expiry',async()=>{
 const T=await import('three');const {LightCycleWalls}=await import('../src/rendering/light-cycle-walls.js');
 const root=new T.Group(),walls=new LightCycleWalls(root);
 const r={time:0,cycles:[{id:0,alive:false}],crashes:[{id:0,time:0}],trails:[{bikeId:0,team:0,x1:0,z1:0,x2:10,z2:0}]};
 const matrix=new T.Matrix4(),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion();
 r.time=3.12;walls.update(r,1);assert.equal(walls.meshes[0].geometry.attributes.deathFlash.getX(0),1);
 r.time=3.59;walls.update(r,1);walls.meshes[0].getMatrixAt(0,matrix);matrix.decompose(position,rotation,scale);
 assert(Math.abs(scale.y-C.trailHeightMeters*.5)<1e-6);assert.equal(walls.meshes[0].material.transparent,false);
 r.time=4;walls.update(r,1);assert.equal(walls.meshes[0].count,0);
 for(const mesh of walls.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});
