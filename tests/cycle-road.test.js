import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRoadCycle,enterRoadMode} from '../src/simulation/cycle-road.js';
import {tickCycleRace,resetCycleRound,updateCycleRace} from '../src/simulation/light-cycles.js';
import {LIGHT_CYCLES as C,cycleFraction} from '../src/game/light-cycles.js';
import {ARENA_WALL} from '../src/game/arena-breaches.js';
const bike=()=>{const b={x:100,z:0,previousX:99,previousZ:0,dir:1,speedMultiplier:1,alive:true};enterRoadMode(b);return b;};
function returningBike(){
 const r={site:{x:0,s:0},time:0,seed:1982,scores:[0,0],round:0,playerId:1};resetCycleRound(r);r.phase='racing';r.arenaPaused=true;
 const b=r.cycles[1];Object.assign(b,{escaped:true,x:0,z:-85.3,previousX:0,previousZ:-85.3,progress:1,yaw:Math.PI,roadSpeed:10,roadHealth:.7,steering:0,lean:0,targetRoadSpeed:10});
 return {r,b};
}
test('reentry waits for the full bike, restores arena turns and pedals, and starts a separate trail',()=>{
 const {r,b}=returningBike();
 r.trails.push({bikeId:1,team:0,dir:2,x1:0,z1:-95,x2:0,z2:-90});b.segment=0;
 const old=JSON.stringify(r.trails[0]);r.pendingTurns=[1];
 const competitors=r.cycles.filter(c=>c.id!==1).map(c=>[c.x,c.z,c.progress]);
 updateCycleRace(r,1/120,0,false,false,{cruise:true});assert(b.escaped);assert.equal(r.trails.length,1);
 for(let i=0;i<120&&b.escaped;i++)updateCycleRace(r,1/120,0,false,false,{cruise:true});
 assert(b.alive&&!b.escaped);assert(!r.arenaPaused);assert.equal(b.dir,2);assert.equal(b.yaw,undefined);assert.equal(b.lean,0);
 assert.deepEqual(r.pendingTurns,[]);assert.equal(b.roadHealth,.7);assert.equal(JSON.stringify(r.trails[0]),old);
 const tail=r.trails.at(-1);assert(tail.startsRun);assert(Math.abs(tail.z1)*C.cellMeters+C.lengthMeters/2<ARENA_WALL.innerMeters);
 const f=cycleFraction(r,b);assert.equal(b.previousZ+(b.z-b.previousZ)*f,tail.z1);
 assert.deepEqual(r.cycles.filter(c=>c.id!==1).map(c=>[c.x,c.z,c.progress]),competitors);
 updateCycleRace(r,.2,1,true,false);assert.equal(b.dir,3);assert(b.boosting);assert(b.turboCharge<1);
 const fast=b.speedMultiplier;updateCycleRace(r,.2,0,true,true);assert(!b.boosting);assert(b.speedMultiplier<fast);
 assert.notDeepEqual(r.cycles.filter(c=>c.id!==1).map(c=>[c.x,c.z,c.progress]),competitors);
 assert.equal(JSON.stringify(r.trails[0]),old);assert(r.trails.length>=3);
});
test('reentered cycles use lethal arena trail collisions even after gentle road riding',()=>{
 const {r,b}=returningBike();b.z=b.previousZ=-84;
 updateCycleRace(r,1/120,0,false,false,{cruise:true});assert(!b.escaped);
 const z=b.z+1,index=(z+C.halfCells)*(C.halfCells*2+1)+b.x+C.halfCells;r.occupied[index]=3;
 tickCycleRace(r,()=>b.dir,[b]);assert(!b.alive);assert.equal(r.crashes.at(-1).id,b.id);
});
test('another exit and reentry restore both modes without extending old trail sections',()=>{
 const {r,b}=returningBike();b.z=b.previousZ=-84;updateCycleRace(r,1/120);
 assert(!b.escaped);
 Object.assign(b,{x:99,z:20,previousX:98,previousZ:20,dir:1,segment:undefined});tickCycleRace(r,()=>1,[b]);assert(b.escaped);
 updateCycleRace(r,1/120);assert(r.arenaPaused);
 Object.assign(b,{x:10,z:-84,previousX:10,previousZ:-84,yaw:Math.PI,roadSpeed:10});
 const previous=JSON.stringify(r.trails);r.phase='result';
 updateCycleRace(r,1/120);assert(!b.escaped);assert(!r.arenaPaused);assert.equal(r.phase,'racing');
 assert.equal(JSON.stringify(r.trails.slice(0,-1)),previous);assert(r.trails.at(-1).startsRun);
});
test('road transition preserves speed, throttle accelerates, release coasts and brake stops',()=>{
 const b=bike();assert.equal(b.roadSpeed,38.4);assert.equal(b.x,99);
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{throttle:true},()=>true);
 const fast=b.roadSpeed;assert(fast>38.4&&fast<60);
 advanceRoadCycle(b,1/120,{},()=>true);assert(b.roadSpeed<fast&&b.roadSpeed>fast-1);
 for(let i=0;i<400;i++)advanceRoadCycle(b,1/120,{throttle:true,brake:true},()=>true);
 assert.equal(b.roadSpeed,-3);assert(b.alive);
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{},()=>true);
 assert.equal(b.roadSpeed,0);
});
test('road steering is continuous with lean, not quarter turns, and swept collision stops motion',()=>{
 const b=bike(),yaw=b.yaw;
 advanceRoadCycle(b,1/120,{steer:1},()=>true);
 assert(b.yaw<yaw&&b.yaw>yaw-.02);assert(b.lean<0);
 const before={x:b.x,z:b.z};let sweep;
 advanceRoadCycle(b,1/120,{throttle:true},(from,to)=>{sweep={from:{x:from.x,z:from.z},to};return false;});
 assert.deepEqual(sweep.from,before);assert.notDeepEqual(sweep.from,sweep.to);
 assert(!b.alive);assert.equal(b.x,before.x);assert.equal(b.z,before.z);
});
test('escaped cycle leaves no new trail and can ride after the arena result',()=>{
 const r={site:{x:0,s:0},time:0,seed:1982,scores:[0,0],round:0,playerId:1};resetCycleRound(r);r.phase='racing';
 const b=r.cycles[1];Object.assign(b,{x:98,z:1,previousX:97,previousZ:1,dir:1});
 tickCycleRace(r,()=>1,[b]);assert(b.escaped);const trails=JSON.stringify(r.trails.filter(t=>t.bikeId===b.id)),count=Object.keys(r.outerOccupied).length;
 const x=b.x;updateCycleRace(r,.25,1,false,false,{throttle:true,steer:.3});assert(b.alive);assert(b.x>x);
 assert.equal(JSON.stringify(r.trails.filter(t=>t.bikeId===b.id)),trails);assert.equal(Object.keys(r.outerOccupied).length,count);
 r.phase='result';r.remaining=0;const next=b.x;updateCycleRace(r,.25,0,false,false,{throttle:true});assert(b.x>next);
});

test('hold duration builds lean progressively and more slowly at high speed',()=>{
 const slow=bike(),fast=bike();slow.roadSpeed=20;fast.roadSpeed=80;
 for(let i=0;i<30;i++){advanceRoadCycle(slow,1/120,{steer:1},()=>true);advanceRoadCycle(fast,1/120,{steer:1},()=>true);}
 assert(Math.abs(fast.lean)<Math.abs(slow.lean));const early=Math.abs(fast.lean);
 for(let i=0;i<60;i++)advanceRoadCycle(fast,1/120,{steer:1},()=>true);
 assert(Math.abs(fast.lean)>early*1.5);const held=Math.abs(fast.lean);
 for(let i=0;i<120;i++)advanceRoadCycle(fast,1/120,{},()=>true);
 assert(Math.abs(fast.lean)<held*.1);
});
test('road turbo accelerates harder, spends charge and recharges on release',()=>{
 const normal=bike(),boost=bike();
 for(let i=0;i<120;i++){advanceRoadCycle(normal,1/120,{throttle:true},()=>true);advanceRoadCycle(boost,1/120,{throttle:true,turbo:true},()=>true);}
 assert(boost.roadSpeed>normal.roadSpeed);assert(boost.boosting);assert(boost.turboCharge<.81);
 const charge=boost.turboCharge;advanceRoadCycle(boost,.1,{},()=>true);assert(!boost.boosting);assert(boost.turboCharge>charge);
 advanceRoadCycle(boost,.1,{turbo:true,brake:true},()=>true);assert(!boost.boosting);
});

test('road impacts use normal speed: gentle bumps survive, glancing hits deflect, hard hits kill',()=>{
 const bump=bike();bump.roadSpeed=1;
 advanceRoadCycle(bump,1/120,{},()=>({normal:{x:1,z:0}}));
 assert(bump.alive);assert.equal(bump.roadHealth,1);assert.equal(bump.roadSpeed,0);
 const moderate=bike();moderate.roadSpeed=10;
 const x=moderate.x;advanceRoadCycle(moderate,1/120,{},()=>({normal:{x:1,z:0}}));
 assert(moderate.alive);assert(moderate.roadHealth<1&&moderate.roadHealth>0);assert.equal(moderate.x,x);
 assert(moderate.roadSpeed<2);assert(Math.sin(moderate.yaw)>0);
 const glance=bike();glance.roadSpeed=40;glance.yaw=-Math.asin(.2);
 advanceRoadCycle(glance,1/120,{},()=>({normal:{x:1,z:0}}));
 assert(glance.alive);assert(glance.roadHealth>moderate.roadHealth);assert(glance.roadSpeed>25);
 const severe=bike();severe.roadSpeed=20;
 assert.equal(advanceRoadCycle(severe,1/120,{},()=>({normal:{x:1,z:0}})),false);assert(!severe.alive);
 const damaged=bike();damaged.roadSpeed=16;damaged.roadHealth=.2;
 advanceRoadCycle(damaged,1/120,{},()=>({normal:{x:1,z:0}}));assert(!damaged.alive);
});

test('low-speed steering responds promptly with tighter radius and less lean than highway turns',()=>{
 const sample=speed=>{const b=bike();b.yaw=0;b.roadSpeed=speed;let previous=0,rate=0;
  for(let i=0;i<60;i++){b.roadSpeed=speed;previous=b.yaw;advanceRoadCycle(b,1/120,{steer:1},()=>true);rate=(b.yaw-previous)*120;}
  return {rate:Math.abs(rate),lean:Math.abs(b.lean),radius:speed/Math.abs(rate)};
 };
 const slow=sample(3),fast=sample(40);
 assert(slow.rate>fast.rate*1.5);assert(slow.radius>4&&slow.radius<5);assert(slow.lean<.15);
 assert(slow.lean<fast.lean);
 const stopped=bike();stopped.roadSpeed=0;const yaw=stopped.yaw;
 for(let i=0;i<60;i++)advanceRoadCycle(stopped,1/120,{steer:1},()=>true);
 assert.equal(stopped.yaw,yaw);assert.equal(stopped.lean,0);
 // No steering discontinuity at either end of the blend.
 for(const speed of [3,12])assert(Math.abs(sample(speed-.001).rate-sample(speed+.001).rate)<.005);
});

test('braking crosses a full stop before slow reverse, release holds still, throttle drives forward',()=>{
 const b=bike();b.roadSpeed=5;let stopped=false;
 for(let i=0;i<240;i++){advanceRoadCycle(b,1/120,{brake:true},()=>true);if(b.roadSpeed===0)stopped=true;assert(b.roadSpeed>=-3);}
 assert(stopped);assert.equal(b.roadSpeed,-3);
 const yaw=b.yaw;advanceRoadCycle(b,.1,{brake:true,steer:1},()=>true);assert(b.yaw>yaw);
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{},()=>true);
 assert.equal(b.roadSpeed,0);const point={x:b.x,z:b.z};
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{},()=>true);
 assert.deepEqual({x:b.x,z:b.z},point);
 advanceRoadCycle(b,.1,{throttle:true},()=>true);assert(b.roadSpeed>0);
});

test('road wall sweep ignores triangle padding and permits backing away from contact',async()=>{
 const {cycleWallContact}=await import('../src/simulation/cycle-wall-contact.js');
 const edge={a:{x:0,s:-100},b:{x:0,s:100},nx:1,ns:0};
 const world={nearbyWalls:()=>[{edges:[edge]}],insideWall:(_w,x)=>x<0};
 assert.equal(cycleWallContact(world,{x:4,s:0},{x:3,s:0},.8),null);
 assert(cycleWallContact(world,{x:1,s:0},{x:.6,s:0},.8));
 assert.equal(cycleWallContact(world,{x:.79,s:0},{x:1,s:0},.8),null);
 assert(cycleWallContact(world,{x:4,s:0},{x:-4,s:0},.8));
 const pointWorld={nearbyWalls:()=>[{edges:[{a:{x:0,s:0},b:{x:1,s:100},nx:1,ns:0}]}],insideWall:()=>false};
 assert.equal(cycleWallContact(pointWorld,{x:3,s:-10},{x:3,s:-9},.8),null);
});

test('held-speed cruise holds release speed, X brakes or selects reverse at rest, W/S leave reverse',async()=>{
 const {setRoadSpeedControl}=await import('../src/simulation/cycle-road.js');
 const b=bike();b.roadSpeed=0;b.targetRoadSpeed=0;
 setRoadSpeedControl(b,{cruise:true,speedAdjust:1});assert.equal(b.targetRoadSpeed,55);
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{cruise:true},()=>true);
 const releaseSpeed=b.roadSpeed;setRoadSpeedControl(b,{cruise:true});
 for(let i=0;i<240;i++)advanceRoadCycle(b,1/120,{cruise:true},()=>true);
 assert(Math.abs(b.roadSpeed-releaseSpeed)<1e-8);
 setRoadSpeedControl(b,{cruise:true,brake:true,reverse:true});assert(!b.reverseGear);
 for(let i=0;i<240;i++)advanceRoadCycle(b,1/120,{cruise:true,brake:true},()=>true);
 assert.equal(b.roadSpeed,0);assert.equal(b.targetRoadSpeed,0);
 setRoadSpeedControl(b,{cruise:true,reverse:true});assert(b.reverseGear);
 for(let i=0;i<240;i++)advanceRoadCycle(b,1/120,{cruise:true},()=>true);
 assert.equal(b.roadSpeed,-3);
 setRoadSpeedControl(b,{cruise:true,speedAdjust:-1});assert(!b.reverseGear);assert.equal(b.targetRoadSpeed,0);
 for(let i=0;i<120;i++)advanceRoadCycle(b,1/120,{cruise:true},()=>true);
 assert.equal(b.roadSpeed,0);
 b.reverseGear=true;setRoadSpeedControl(b,{cruise:true,speedAdjust:1});assert(!b.reverseGear);assert.equal(b.targetRoadSpeed,55);
});

test('road braking doubles the deceleration cap and low-speed held-speed response',async()=>{
 const {ROAD_CYCLE}=await import('../src/game/cycle-road.js');
 const old={...ROAD_CYCLE,brakeMetersPerSecondSquared:18,brakeResponsePerSecond:2,rollingDragMetersPerSecondSquared:0,aeroDragPerMeter:0};
 const current={...ROAD_CYCLE,rollingDragMetersPerSecondSquared:0,aeroDragPerMeter:0};
 for(const speed of [5,40])for(const brake of [false,true]){
  const before=bike(),after=bike();
  for(const b of [before,after])Object.assign(b,{roadSpeed:speed,targetRoadSpeed:0});
  advanceRoadCycle(before,1/120,{cruise:true,brake},()=>true,old);
  advanceRoadCycle(after,1/120,{cruise:true,brake},()=>true,current);
  assert(Math.abs((speed-after.roadSpeed)-2*(speed-before.roadSpeed))<1e-10);
 }
});
