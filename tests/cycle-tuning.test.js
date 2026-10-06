import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GameSession} from '../src/simulation/game-session.js';
import {browserScenario} from '../src/game/browser-scenario.js';
import {ROAD_CYCLE} from '../src/game/cycle-road.js';
import {CycleTireTraces,TIRE_TRACE} from '../src/rendering/cycle-tire-traces.js';
const world=browserScenario({pathname:'/',search:'?layoutSeed=1982'}).world;
test('live trace reaches the rendered tire between samples and fades when stopped',()=>{
 const root=new THREE.Group(),point={x:10,z:20},traces=new CycleTireTraces(root,{contactFor:()=>({...point})});
 const race={round:1,time:0,phase:'racing',cycles:[{id:1,alive:true,escaped:true,x:999,z:999,yaw:0}]};
 traces.update(race);point.x+=.1;point.z+=.05;race.time=.1;traces.update(race);
 assert.equal(traces.mesh.count,0);assert.equal(traces.tip.count,1);
 const matrix=new THREE.Matrix4();traces.tip.getMatrixAt(0,matrix);
 const end=new THREE.Vector3(.5,0,0).applyMatrix4(matrix);
 assert(Math.abs(end.x-point.x)<1e-5);assert(Math.abs(end.z-point.z)<1e-5);
 const born=traces.tipBirths[0];race.time=1;traces.update(race);assert.equal(traces.tipBirths[0],born);
 race.time=9;traces.update(race);assert.equal(traces.tip.count,0);
 traces.dispose();assert.equal(root.children.length,0);
});
test('road tuning belongs to each session, affects movement, and survives reset and placement',()=>{
 const a=new GameSession({world,seed:1982}),b=new GameSession({world,seed:1982});
 a.configure('roadCycle',{accelerationMetersPerSecondSquared:16});
 for(const s of [a,b]){
  s.requestCycleEntry({startOutside:true});s.advance({},1/120);
  for(let i=0;i<60;i++)s.advance({cycleRoad:{cruise:true,speedAdjust:1}},1/120);
 }
 assert(a.run.cycleRace.cycles[a.run.cycleRace.playerId].roadSpeed>b.run.cycleRace.cycles[b.run.cycleRace.playerId].roadSpeed*1.8);
 assert.equal(ROAD_CYCLE.accelerationMetersPerSecondSquared,8);
 a.place({cycleRace:structuredClone(a.run.cycleRace)});assert.equal(a.run.cycleRace.roadConfig,a.settings.roadCycle);
 a.reset();assert.equal(a.run.cycleRace.roadConfig.accelerationMetersPerSecondSquared,16);
 const before={...a.settings.roadCycle};
 for(const values of [{wheelbaseMeters:0},{steeringBuildSeconds:NaN},{steeringBlendStartMetersPerSecond:20},{maxSpeedMetersPerSecond:100},{fatalImpactMetersPerSecond:1}])assert.throws(()=>a.configure('roadCycle',values));
 assert.deepEqual(a.settings.roadCycle,before);
 a.configure('roadCycle',ROAD_CYCLE);assert.deepEqual(a.settings.roadCycle,ROAD_CYCLE);
});
test('tire traces only record road motion, fade on simulation time, and clear at restart',()=>{
 const root=new THREE.Group(),groundFloor={position:{y:-.06}},traces=new CycleTireTraces(root,{groundFloor});
 const bike={id:1,alive:true,escaped:true,x:110,z:0,yaw:0};
 const race={round:1,phase:'racing',time:0,cycles:[bike]};
 traces.update(race);bike.z=-1;race.time=.1;traces.update(race);assert(traces.activeCount>0);
 const count=traces.activeCount;traces.update(race);assert.equal(traces.activeCount,count);
 const matrix=new THREE.Matrix4();traces.mesh.getMatrixAt(0,matrix);assert(Math.abs(matrix.elements[13]-(-.06+TIRE_TRACE.surfaceOffsetMeters))<1e-6);
 bike.escaped=false;bike.z-=1;race.time=.2;traces.update(race);assert.equal(traces.activeCount,count);
 race.time=9;traces.update(race);assert.equal(traces.activeCount,0);assert.equal(traces.mesh.count,0);
 bike.escaped=true;traces.update(race);bike.z-=1;race.time+=.1;traces.update(race);assert(traces.activeCount>0);
 race.round++;traces.update(race);assert.equal(traces.activeCount,0);
 const anchor={...bike};bike.z-=100;traces.update(race);assert.equal(traces.activeCount,0,'teleports leave no connecting line');
 Object.assign(bike,anchor);traces.update(race);
 traces.dispose();assert.equal(root.children.length,0);
});

test('saved road defaults adopt stronger brakes while custom handling survives',async()=>{
 const {migrateRoadCycleTuning}=await import('../src/game/cycle-road.js');
 assert.deepEqual(migrateRoadCycleTuning({brakeMetersPerSecondSquared:18,wheelbaseMeters:3}),{brakeMetersPerSecondSquared:36,wheelbaseMeters:3});
 assert.equal(migrateRoadCycleTuning({brakeMetersPerSecondSquared:25}).brakeMetersPerSecondSquared,25);
 assert.equal(migrateRoadCycleTuning({brakeMetersPerSecondSquared:18,brakeResponsePerSecond:4}).brakeMetersPerSecondSquared,18);
});
