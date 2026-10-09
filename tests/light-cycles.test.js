import test from 'node:test';
import {config} from '../src/game/config.js';
import assert from 'node:assert/strict';
import {createScenario} from '../src/levels/scenario.js';
import {createCycleRace,updateCycleRace,tickCycleRace} from '../src/simulation/light-cycles.js';
import {LIGHT_CYCLES as C,cycleTrailState} from '../src/game/light-cycles.js';
import {createRecognizers,updateRecognizers} from '../src/simulation/recognizers.js';
import {flyArenaPatrol,returningToArena} from '../src/simulation/arena-patrol.js';
import {createRun} from '../src/simulation/run.js';
import {ARENA_WALL} from '../src/game/arena-breaches.js';
const {world}=createScenario({layout:'blueprint',centralLabyrinth:true});
const race=()=>createCycleRace(world,1982);
test('launch trails leave two cycle lengths of clearance from the nearest arena wall and remain connected as bikes advance',()=>{
 const r=race();r.remaining=0;updateCycleRace(r,1/60);
 assert.equal(r.phase,'racing');
 for(const b of r.cycles.filter(b=>b.alive)){
  const t=r.trails[b.segment];
  assert.equal(t.x1,b.x);assert.equal(t.x2,b.x);assert.equal(t.z2,b.z);
  assert(Math.abs(Math.abs(t.z1*C.cellMeters)-(ARENA_WALL.innerMeters-C.lengthMeters*C.startWallClearanceLengths))<1e-9);
 }
 const starts=r.trails.map(t=>t.z1);tickCycleRace(r,(_r,b)=>b.dir);
 for(const b of r.cycles.filter(b=>b.alive)){
  const t=r.trails[b.segment];assert.equal(t.z1,starts[b.id]);assert.equal(t.initial,false);
 }
});
test('six bikes, two equal teams, deterministic rounds with bounded trails',()=>{
 const a=race(),b=race();assert.equal(a.cycles.length,6);assert.equal(a.cycles.filter(c=>c.team===0).length,3);
 let completed=0;const expectedScores=[0,0,0,0];
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

test('cycle explosions follow film cadence and reset without allocating new effects',async()=>{
 const T=await import('three');const {CycleExplosions,explosionFrame}=await import('../src/rendering/cycle-explosions.js');
 const {disposeSceneResources}=await import('../src/rendering/scene-resources.js');
 assert.equal(explosionFrame(.03),0);assert.equal(explosionFrame(1/24),1);
 const root=new T.Group(),bursts=new CycleExplosions(root),count=root.children.length;
 const r={time:0,crashes:[{id:0,x:2,z:3,time:0,dir:1}]};bursts.update(r);
 const effect=bursts.effects[0];assert(effect.group.visible);assert(effect.rays.visible);assert(!effect.arcs[0].visible);
 r.time=5/24;bursts.update(r);assert(effect.arcs.every(a=>a.visible));
 const matrices=Array.from(effect.chips.instanceMatrix.array);bursts.update(r);assert.deepEqual(Array.from(effect.chips.instanceMatrix.array),matrices);
 r.time=10/24;bursts.update(r);assert(!effect.rays.visible);assert(effect.group.visible);
 r.time=1;bursts.update(r);assert(!effect.group.visible);
 r.time=0;r.crashes=[];bursts.update(r);assert(bursts.effects.every(e=>!e.group.visible));assert.equal(root.children.length,count);
 disposeSceneResources(root);
});

test('trail length is the inner perimeter; oldest walls and collision cells expire together',async()=>{
 const {trimCycleTrails}=await import('../src/simulation/cycle-trails.js');
 const {CYCLE_TRAIL_LIMIT,cycleTrailLength,cycleTrailHeadTrim}=await import('../src/game/cycle-trails.js');
 const r=race();r.phase='racing';r.occupied.fill(0);
 const b=r.cycles[0];Object.assign(b,{progress:.5,x:70,z:70,segment:5});
 const points=[[-80,-80],[80,-80],[80,80],[-80,80],[-80,-70],[70,-70],[70,70]];
 r.trails=points.slice(1).map((p,i)=>({bikeId:0,team:0,x1:points[i][0],z1:points[i][1],x2:p[0],z2:p[1]}));
 const active=r.trails[b.segment],other={bikeId:1,team:0,x1:0,z1:0,x2:1,z2:0};
 r.trails.splice(1,0,other);b.segment++;r.cycles[1].segment=1;
 const cell=(x,z)=>(z+C.halfCells)*(C.halfCells*2+1)+x+C.halfCells;
 r.occupied[cell(-80,-80)]=1;r.occupied[cell(0,0)]=2;
 trimCycleTrails(r);
 const length=()=>r.trails.filter(t=>t.bikeId===0).reduce((n,t)=>n+cycleTrailLength(t),0)-cycleTrailHeadTrim(r,b);
 assert.equal(CYCLE_TRAIL_LIMIT.lengthMeters,8*ARENA_WALL.innerMeters);
 assert(Math.abs(length()-CYCLE_TRAIL_LIMIT.lengthMeters)<1e-8);
 assert.equal(r.occupied[cell(-80,-80)],0);assert.equal(r.occupied[cell(70,0)],1);
 assert.equal(r.occupied[cell(0,0)],2);
 assert.equal(r.trails[b.segment],active);assert.equal(r.trails[r.cycles[1].segment],other);
 const tail=r.trails.find(t=>t.bikeId===0),oldZ=tail.z1;
 b.progress=.75;trimCycleTrails(r);
 assert(Math.abs(length()-CYCLE_TRAIL_LIMIT.lengthMeters)<1e-8);
 assert(Math.abs(tail.z1-oldZ-.25)<1e-8);
 b.alive=false;trimCycleTrails(r);
 assert(Math.abs(length()-CYCLE_TRAIL_LIMIT.lengthMeters)<1e-8);
});

test('head trimming stops at the most recent arena reentry',async()=>{
 const {cycleTrailHeadTrim}=await import('../src/game/cycle-trails.js');
 const r=race(),b=r.cycles[0];b.segment=1;b.progress=0;r.phase='racing';
 r.trails=[{bikeId:0,x1:0,z1:0,x2:50,z2:0},{bikeId:0,x1:0,z1:0,x2:.1,z2:0,joining:true,startsRun:true}];
 assert.equal(cycleTrailHeadTrim(r,b),.1*C.cellMeters);
});
