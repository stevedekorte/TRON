import {intercept} from '../src/simulation/intercept.js';
import {formationTarget} from '../src/simulation/formation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, moveTank, cannonTarget, cannonPose, updateWeapons, startPursuit, boostTank } from '../src/simulation/run.js';
import { GRID, SIZE, CELL, HALF, OPEN_CELLS, SPAWN, cellCenter, gridToWorld, worldToGrid, freePosition, lineOfSight, wallIntersection, WALLS } from '../src/levels/maze.js';
import { createRecognizers, perceive, canSeeClu, updateRecognizers, predict, SENSORS } from '../src/simulation/recognizers.js';
import { config } from '../src/game/config.js';
const tick=(r,input={},seconds=1)=>{for(let i=0;i<Math.round(seconds*60);i++)step(r,input,1/60);};

test('maze is connected with branches, cycles, dead ends and four exterior openings',()=>{
  const key=(c,r)=>`${c},${r}`,seen=new Set(),queue=[OPEN_CELLS[0]];let edges=0,junctions=0,deadEnds=0,openings=0;
  while(queue.length){const p=queue.pop(),k=key(p.c,p.r);if(seen.has(k))continue;seen.add(k);
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const c=p.c+dc,r=p.r+dr;if(GRID[r]?.[c]===0)queue.push({c,r});}}
  for(const p of OPEN_CELLS){let degree=0;for(const [dc,dr]of [[1,0],[-1,0],[0,1],[0,-1]])if(GRID[p.r+dr]?.[p.c+dc]===0)degree++;
    edges+=degree;if(degree>=3)junctions++;if(degree===1)deadEnds++;if(p.c===0||p.r===0||p.c===SIZE-1||p.r===SIZE-1)openings++;}
  assert.equal(seen.size,OPEN_CELLS.length);assert.ok(edges/2>=OPEN_CELLS.length);assert.ok(junctions>10);assert.ok(deadEnds>5);assert.ok(openings>=4);
  assert.ok(freePosition(SPAWN.x,SPAWN.s,config.tankRadius));
});

test('tank sweeps solid walls, slides, enters maze and can turn in place',()=>{
  const r=createRun();Object.assign(r,gridToWorld(-HALF+CELL*2.5,-HALF-20));
  assert.equal(moveTank(r,gridToWorld(0,200).x,gridToWorld(0,200).s),true);assert.ok(worldToGrid(r.x,r.s).v<-HALF);assert.ok(freePosition(r.x,r.s,config.tankRadius-.001));
  const before=r.x;moveTank(r,12,12);assert.ok(r.x>before);assert.ok(freePosition(r.x,r.s,config.tankRadius-.001));
  Object.assign(r,gridToWorld(0,-HALF-40));moveTank(r,gridToWorld(0,160).x,gridToWorld(0,160).s);assert.ok(worldToGrid(r.x,r.s).v>-HALF+100);
  const x=r.x,s=r.s;tick(r,{steer:1},1);assert.ok(r.yaw<-.5);assert.equal(r.x,x);assert.equal(r.s,s);
});

test('wall geometry occludes sight and shots below its roof but not above',()=>{
  const u=-HALF+CELL*2.5,a={...gridToWorld(u,-HALF-10),y:20},b={...gridToWorld(u,-HALF+CELL+10),y:2.8};
  assert.equal(lineOfSight(a,b),false);assert.ok(wallIntersection(a,b)>0);
  assert.equal(lineOfSight({...a,y:90},{...b,y:90}),true);
  assert.equal(lineOfSight({...gridToWorld(0,-HALF-10),y:20},{...gridToWorld(0,-HALF+CELL+10),y:2.8}),true);
});

test('Recognizer vision has range and field of view; occlusion freezes the sighting',()=>{
  const e=createRecognizers()[0];Object.assign(e,{...gridToWorld(-HALF+CELL*2.5,-HALF-45),y:30,yaw:SPAWN.yaw,nextSense:0});
  const clu={...gridToWorld(-HALF+CELL*2.5,-HALF-10),yaw:SPAWN.yaw,speed:10};
  assert.equal(canSeeClu(e,clu),true);perceive(e,clu,1);const sighting={...e.memory};
  const hidden={...clu,...cellCenter(1,1)};assert.equal(canSeeClu(e,hidden),false);perceive(e,hidden,2);
  assert.equal(e.canSee,false);assert.deepEqual(e.memory,sighting);
  assert.equal(canSeeClu(e,{...clu,s:e.s-100}),false);
  assert.equal(canSeeClu(e,{...clu,s:e.s+SENSORS.range+100}),false);
});

test('radio delivers delayed sighting copies within range and never renews old timestamps',()=>{
  const r=createRun();Object.assign(r,{x:-1850,s:-1700,time:1});
  const [a,b,c]=r.recognizers;r.recognizers=[a,b,c];
  Object.assign(a,{x:-1850,s:-1800,y:73,yaw:0,nextSense:0});Object.assign(b,{x:-2050,s:-1700,nextSense:100});Object.assign(c,{x:900,s:900,nextSense:100});
  updateRecognizers(r,1/60);assert.ok(a.memory);assert.equal(b.memory,null);assert.equal(c.memory,null);
  r.time=1+SENSORS.radioDelay+.01;updateRecognizers(r,1/60);
  assert.equal(b.memory.source,a.id);assert.equal(b.memory.seenAt,1);assert.notEqual(b.memory,a.memory);assert.equal(c.memory,null);
  r.x=2000;r.s=2000;r.time=50;updateRecognizers(r,1/60);
  assert.equal(a.memory,null);assert.equal(b.memory,null);
});

test('hidden Clu positions do not influence remembered pursuit or search',()=>{
  const a=createRun();a.recognizers=a.recognizers.slice(0,1);
  Object.assign(a.recognizers[0],{x:-1800,s:-550,memory:{x:-1800,s:-500,vx:0,vs:10,seenAt:0,source:0},goal:null,canSee:false});
  a.x=1600;a.s=1600;const b=structuredClone(a);b.x=-1900;b.s=1800;b.yaw=2;
  tick(a,{},12);tick(b,{},12);
  assert.deepEqual(a.recognizers,b.recognizers);assert.equal(a.recognizers[0].memory.seenAt,0);
  tick(a,{},30);assert.equal(a.recognizers[0].memory,null);assert.equal(a.recognizers[0].state,'wander');
});

test('heading prediction is bounded and stops at known walls',()=>{
  const memory={...gridToWorld(-HALF+CELL*2.5,-HALF-20),vx:gridToWorld(0,20).x,vs:gridToWorld(0,20).s,seenAt:0};
  const p=predict(memory,30);assert.ok(worldToGrid(p.x,p.s).v<-HALF);assert.deepEqual(p,predict(memory,300));
});

test('turret rotates independently and acquired shots lead while unassisted shots follow the barrel',()=>{
  const r=createRun();r.x=-1850;r.s=-1800;r.yaw=0;const s=r.s;
  tick(r,{turret:1},1);assert.equal(r.yaw,0);assert.equal(r.s,s);assert.ok(r.turretYaw< -1);
  r.turretYaw=0;r.recognizers=r.recognizers.slice(0,1);Object.assign(r.recognizers[0],{x:-1845,s:-1700,y:73,vx:0,vs:0});
  assert.equal(cannonTarget(r).lock,true);step(r,{fire:true},1/60);
  assert.ok(r.projectiles[0].vx>0);assert.ok(r.projectiles[0].vy>0);
  r.turretYaw=.6;r.cooldown=0;r.projectiles=[];step(r,{fire:true},1/60);
  assert.equal(r.projectiles[0].vy,0);assert.ok(Math.abs(Math.atan2(-r.projectiles[0].vx,r.projectiles[0].vs)-.6)<1e-9);
});

test('walls block auto aim and a protruding muzzle cannot shoot through a wall',()=>{
  const r=createRun();Object.assign(r,gridToWorld(-HALF+CELL*2.5,-HALF-4));r.yaw=SPAWN.yaw;r.recognizers=r.recognizers.slice(0,1);
  Object.assign(r.recognizers[0],{...gridToWorld(-HALF+CELL*2.5,-HALF+CELL*2),y:30});
  assert.equal(cannonTarget(r).lock,false);step(r,{fire:true},1/60);assert.equal(r.projectiles.length,0);
});

test('independent agents persist, simulation has no timed outcome, reset is clean',()=>{
  const r=createRun();for(const e of r.recognizers.slice(0,5))assert.ok(Math.abs(worldToGrid(e.x,e.s).u)>HALF||Math.abs(worldToGrid(e.x,e.s).v)>HALF);
  const start=r.recognizers.map(e=>[e.x,e.s]);tick(r,{},100);
  assert.equal(r.status,'running');assert.equal(r.recognizers.length,9);assert.ok(r.radio.length<40);
  assert.ok(r.recognizers.every((e,i)=>Math.hypot(e.x-start[i][0],e.s-start[i][1])>50));
  const fresh=createRun();assert.equal(fresh.radio.length,0);assert.ok(fresh.recognizers.every(e=>e.memory===null));assert.equal(fresh.turretYaw,0);
});

test('fixed simulation steps remain independent of rendering schedule',()=>{
  function at(rate){const r=createRun();let acc=0;for(let f=0;f<rate*4;f++){acc+=1/rate;while(acc>=1/60-1e-10){step(r,{throttle:1},1/60);acc-=1/60;}}return r;}
  assert.deepEqual(at(30),at(144));
});

test('clipped slab tips are physically open, not invisible rectangular walls',()=>{
  let tested=false;
  for(let r=1;r<SIZE-1&&!tested;r++)for(let c=1;c<SIZE-1&&!tested;c++)if(GRID[r][c]&&GRID[r-1][c]===0&&GRID[r][c-1]===0) {
    const tip=gridToWorld(c*CELL-HALF+CELL*.04,r*CELL-HALF+CELL*.04);
    assert.ok(freePosition(tip.x,tip.s,0));assert.equal(wallIntersection({...tip,y:80},{...tip,y:2}),null);
    const center=cellCenter(c,r);assert.equal(freePosition(center.x,center.s,0),false);
    assert.notEqual(wallIntersection({...center,y:80},{...center,y:2}),null);tested=true;
  }
  assert.equal(tested,true);
});

test('converging aircraft retain physical clearance at the reduced model scale',()=>{
  const r=createRun();r.x=-1850;r.s=-1600;
  r.recognizers.forEach((e,i)=>Object.assign(e,{x:-1850+i*.1,s:-1700,y:73,yaw:0}));
  tick(r,{},20);
  for(let i=0;i<r.recognizers.length;i++)for(let j=i+1;j<r.recognizers.length;j++) {
    const a=r.recognizers[i],b=r.recognizers[j];assert.ok(Math.hypot(a.x-b.x,a.s-b.s)>=23.9);
  }
});


test('crush commits to a sighting, folds, drops, misses moving tanks and recovers',async()=>{
  const {beginCrush,advanceCrush,resolveCrush}=await import('../src/simulation/crush.js');
  const e={x:-1800,s:-1800,y:80,yaw:0,canSee:true,memory:{x:-1800,s:-1800,seenAt:0},fold:0};
  beginCrush(e,0);assert.equal(e.attack.phase,'fold');
  const run={x:-1800,s:-1800,events:[],crushed:false};
  for(let i=1;i<=60;i++)advanceCrush(e,i/60,1/60);
  assert.equal(e.y,80);assert.ok(e.fold>0&&e.fold<1);
  run.x+=30; // Escaping after commitment cannot steer the falling craft.
  for(let i=61;i<=300;i++){advanceCrush(e,i/60,1/60);resolveCrush(run,e);}
  assert.equal(run.crushed,false);assert.equal(e.x,-1800);assert.ok(e.y>11);
  for(let i=301;i<=700;i++)advanceCrush(e,i/60,1/60);
  assert.equal(e.attack,null);assert.equal(e.fold,0);
  e.attack={impact:true};run.x=e.x;resolveCrush(run,e);
  assert.equal(run.crushed,true);assert.equal(run.speed,0);
  const count=run.events.length;resolveCrush(run,e);assert.equal(run.events.length,count);
});

test('crush needs direct recent sight and room for the whole descending craft',async()=>{
  const {beginCrush}=await import('../src/simulation/crush.js');
  const e={...cellCenter(0,0),y:80,canSee:true};e.memory={x:e.x,s:e.s,seenAt:0};
  beginCrush(e,0);assert.equal(e.attack,undefined);
  Object.assign(e,{x:-1800,s:-1800,canSee:false});e.memory={x:e.x,s:e.s,seenAt:0};
  beginCrush(e,0);assert.equal(e.attack,undefined);
  e.canSee=true;beginCrush(e,1);assert.equal(e.attack,undefined);
});


test('a Recognizer acquires, approaches and crushes a stationary tank autonomously',()=>{
  const r=createRun();Object.assign(r,{x:-1800,s:-1800});
  r.recognizers.forEach((e,i)=>Object.assign(e,{x:-1800,s:-1840,y:80,yaw:0,state:i?'destroyed':'wander'}));
  tick(r,{},10);assert.equal(r.crushed,true);assert.equal(r.status,'running');
  const x=r.x,s=r.s;tick(r,{throttle:1,steer:1,fire:true},1);
  assert.equal(r.x,x);assert.equal(r.s,s);assert.equal(r.shots,0);
  assert.equal(createRun().crushed,false);
});


test('flight adds only forward thrust and carries momentum through a turn',async()=>{
  const {advanceFlight,FLIGHT}=await import('../src/simulation/flight.js');
  const e={x:0,s:0,vx:0,vs:20,yaw:-Math.PI/2},dt=.1;
  advanceFlight(e,dt,FLIGHT.acceleration);
  assert.ok(e.vx>0);assert.ok(e.vs>18);assert.ok(e.s>1.9);
  assert.ok(Math.abs(e.vs-20*Math.exp(-FLIGHT.drag*dt))<1e-10);
  const resting={x:0,s:0,vx:0,vs:0,yaw:.73};advanceFlight(resting,1,-10);
  assert.equal(resting.vx,0);assert.equal(resting.vs,0);
});

test('avoidance changes heading without adding sideways propulsion',async()=>{
  const {navigate}=await import('../src/simulation/recognizers.js');
  const e={...createRecognizers()[0],x:-1800,s:-1800,y:80,yaw:0,vx:0,vs:0,memory:null,goal:{x:-1800,s:-1400},goalUntil:100};
  const other={...e,id:1,x:e.x+30};navigate(e,0,.1,[e,other]);
  assert.ok(e.yaw>0);assert.ok(Math.hypot(e.vx,e.vs)>0);
  assert.ok(Math.abs(e.vx*Math.cos(e.yaw)+e.vs*Math.sin(e.yaw))<1e-10);
});

test('crush waits for a slow approach and preserves residual drift',async()=>{
  const {beginCrush,advanceCrush}=await import('../src/simulation/crush.js');
  const e={x:-1800,s:-1800,y:80,yaw:0,vx:0,vs:10,canSee:true,memory:{x:-1800,s:-1800,seenAt:0}};
  beginCrush(e,0);assert.equal(e.attack,undefined);
  e.vs=1;beginCrush(e,0);assert.ok(e.attack);
  advanceCrush(e,.1,.1);assert.ok(e.vs>0&&e.vs<1);assert.ok(e.s>-1800);
});


test('an aircraft brakes without spinning when already inside the strike footprint',async()=>{
  const {navigate}=await import('../src/simulation/recognizers.js');
  const e={...createRecognizers()[0],x:-1800,s:-1800,y:80,yaw:1,vx:2,vs:0,canSee:true,memory:{x:-1801,s:-1800,vx:0,vs:0,seenAt:0}};
  navigate(e,0,.1,[e]);assert.equal(e.yaw,1);assert.ok(e.vx<1.5);assert.equal(e.vs,0);
  for(let i=1;i<=20;i++){e.memory.seenAt=i/60;navigate(e,i/60,1/60,[e]);}
  assert.ok(e.attack);assert.equal(e.yaw,1);
});


test('five close pursuers yield instead of repeatedly spinning around the tank',()=>{
  const r=createRun();Object.assign(r,{x:-1800,s:-1800});
  r.recognizers.forEach((e,i)=>Object.assign(e,{x:r.x+Math.cos(i*1.256)*35,s:r.s+Math.sin(i*1.256)*35,y:80,yaw:i,vx:0,vs:0}));
  const turns=r.recognizers.map(()=>0);
  for(let i=0;i<1200&&!r.crushed;i++){
    const before=r.recognizers.map(e=>e.yaw);step(r,{},1/60);
    r.recognizers.forEach((e,j)=>turns[j]+=Math.abs(e.yaw-before[j]));
  }
  assert.ok(r.crushed);assert.ok(turns.every(angle=>angle<Math.PI*2));
});

test('blocked crush clearance does not make an overhead aircraft spin',async()=>{
  const {navigate}=await import('../src/simulation/recognizers.js');
  const position=cellCenter(0,0);
  const e={...createRecognizers()[0],...position,y:80,yaw:1,vx:0,vs:0,canSee:true,memory:{...position,vx:0,vs:0,seenAt:0}};
  for(let i=0;i<600;i++){e.memory.seenAt=i/60;navigate(e,i/60,1/60,[e]);}
  assert.equal(e.yaw,1);assert.equal(e.attack,null);
});


test('confirmed crush clears pursuit by radio and old sightings cannot revive it',async()=>{
 const {resolveCrush}=await import('../src/simulation/crush.js');
 const r=createRun();Object.assign(r,{x:-1800,s:-1800});
 r.recognizers=r.recognizers.slice(0,2);
 const [a,b]=r.recognizers;
 Object.assign(a,{x:r.x,s:r.s,y:11,attack:{phase:'hold',impact:true,altitude:80,started:0,velocity:0},fold:1});
 Object.assign(b,{x:r.x+100,s:r.s,y:80,nextSense:Infinity,memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:0,source:0},state:'pursue'});
 resolveCrush(r,a);assert.ok(r.crushed);assert.ok(a.targetGone);assert.equal(a.memory,null);
 tick(r,{},1);assert.ok(b.targetGone);assert.equal(b.memory,null);assert.equal(b.canSee,false);
 r.radio.push({to:b.id,deliverAt:r.time,sighting:{x:r.x,s:r.s,vx:0,vs:0,seenAt:r.time,source:a.id}});
 tick(r,{},10);
 for(const e of r.recognizers){assert.equal(e.state,'wander');assert.equal(e.memory,null);assert.equal(e.attack,null);}
 assert.equal(canSeeClu(b,r),false);assert.ok(createRun().recognizers.every(e=>!e.targetGone));
});


test('radio reports stop at 1000 feet, including vertical separation',()=>{
 assert.equal(SENSORS.radioRange,304.8);
 const r=createRun();Object.assign(r,{x:-4000,s:-4000});
 r.recognizers=r.recognizers.slice(0,4);
 r.recognizers.forEach((e,i)=>Object.assign(e,{x:-1800+[0,304.7,304.9,200][i],s:-1800,y:i===3?320:80,nextSense:Infinity,memory:null}));
 r.recognizers[0].memory={x:-1800,s:-1700,vx:0,vs:0,seenAt:0,source:0};
 updateRecognizers(r,1/60);
 assert.deepEqual(r.radio.map(m=>m.to),[1]);
});


test('wall contact preserves sliding and allows immediate reverse',()=>{
 const w=WALLS.find(w=>w.edges.some(e=>Math.hypot(e.b.x-e.a.x,e.b.s-e.a.s)>20));
 const e=w.edges.find(e=>Math.hypot(e.b.x-e.a.x,e.b.s-e.a.s)>20);
 const start={x:(e.a.x+e.b.x)/2+e.nx*(config.tankRadius+.001),s:(e.a.s+e.b.s)/2+e.ns*(config.tankRadius+.001)};
 const r=createRun();Object.assign(r,start,{yaw:-Math.atan2(-e.nx,-e.ns),recognizers:[]});
 tick(r,{throttle:1},1);assert.ok(Math.abs(r.speed)<.5);
 const before={x:r.x,s:r.s};tick(r,{throttle:-1},.3);
 assert.ok((r.x-before.x)*e.nx+(r.s-before.s)*e.ns>.1);
 Object.assign(r,start,{speed:10,yaw:-Math.atan2(-e.ns-e.nx*.2,e.nx-e.ns*.2)});
 tick(r,{throttle:1},.3);assert.ok(r.speed>10);assert.ok(freePosition(r.x,r.s,config.tankRadius-.001));
});

test('nearby pursuers choose the nearest lead and release support when it is derezzed',()=>{
 const peers=[-1,0,1].map((slot,id)=>({id,x:slot*130,s:-300,y:77,yaw:0,state:'pursue',memory:{x:0,s:0,vx:0,vs:22}}));
 const goal={x:0,s:20};
 assert.equal(formationTarget(peers[1],peers,goal,304.8),null);
 assert.equal(formationTarget(peers[0],peers,goal,304.8).leader,1);
 assert.equal(formationTarget(peers[2],peers,goal,304.8).leader,1);
 assert.equal(formationTarget(peers[0],peers,goal,304.8).x,-130);
 peers[1].state='destroyed';
 assert.equal(formationTarget(peers[0],peers,goal,304.8),null);
 assert.equal(formationTarget(peers[2],peers,goal,304.8),null);
 peers[2].x=-20;peers[2].s=-260;
 assert.equal(formationTarget(peers[0],peers,goal,304.8).leader,2);
 assert.equal(formationTarget(peers[2],peers,goal,304.8),null);
 assert.equal(formationTarget(peers[0],peers,goal,10),null);
});

test('intercept leads crossing, receding and descending targets at projectile speed',()=>{
 const origin={x:0,y:2,s:0},target={x:0,y:77,s:150};
 for(const velocity of [{x:27,y:0,s:0},{x:0,y:0,s:27},{x:0,y:-30,s:0}]){
  const aim=intercept(origin,target,velocity);assert.ok(aim);
  assert.ok(Math.abs(Math.hypot(aim.x,aim.y-2,aim.s)-165*aim.time)<1e-7);
  assert.equal(aim.x,target.x+velocity.x*aim.time);assert.equal(aim.y,target.y+velocity.y*aim.time);
 }
 assert.equal(intercept(origin,target,{x:0,y:0,s:200}),null);
});

test('a fired round hits a crossing Recognizer rather than its old position',()=>{
 const r=createRun();Object.assign(r,{x:-1800,s:-1800,yaw:0,turretYaw:0});
 const muzzle=cannonPose(r),e=r.recognizers[0];r.recognizers=[e];
 Object.assign(e,{x:muzzle.x,s:muzzle.s+150,y:40,yaw:0,vx:27,vs:0,vy:0,health:3,state:'pursue'});
 updateWeapons(r,{fire:true},1/60);assert.ok(r.projectiles[0].vx>20);
 for(let i=0;i<100;i++){e.x+=e.vx/60;updateWeapons(r,{},1/60);}
 assert.equal(e.health,2);
});
test('five opening pursuers advance without collapsing into a crowd',()=>{
 const r=createRun();r.speed=22;startPursuit(r);
 const initial=r.recognizers.slice(0,5).map(e=>({...e})),yaw=r.yaw;
 tick(r,{throttle:1},20);
 for(let i=0;i<5;i++){
  const e=r.recognizers[i],dx=e.x-initial[i].x,ds=e.s-initial[i].s;
  assert.ok(-Math.sin(yaw)*dx+Math.cos(yaw)*ds>400);assert.ok(Number.isFinite(e.x));
 }
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.ok(Math.hypot(r.recognizers[i].x-r.recognizers[j].x,r.recognizers[i].s-r.recognizers[j].s)>23.9);
});

test('turret centering takes the short route without turning the body; manual input cancels',()=>{
 for(const angle of [2.9,-2.9,.01,-.01]){
  const r=createRun();r.recognizers=[];r.yaw=.7;r.turretYaw=angle;r.turretCentering=true;
  step(r,{},1/60);assert.ok(Math.abs(r.turretYaw)<=Math.abs(angle));assert.ok(Math.abs(r.turretYaw-angle)<=config.turretSpeed/60+1e-8);
  tick(r,{},3);assert.equal(r.turretYaw,0);assert.equal(r.turretCentering,false);assert.equal(r.yaw,.7);
 }
 const r=createRun();r.recognizers=[];r.turretYaw=2;r.turretCentering=true;
 step(r,{turret:-1},1/60);assert.equal(r.turretCentering,false);assert.ok(r.turretYaw>2);
});

test('turbo lasts ten simulated seconds, cannot stack, permits braking and clears on reset/crush',()=>{
 const r=createRun();Object.assign(r,{x:-5000,s:-5000,yaw:0,recognizers:[]});
 assert.equal(boostTank(r),true);assert.equal(r.speed,config.maxSpeed*2.5);
 tick(r,{},5);assert.equal(boostTank(r),false);assert.ok(Math.abs(r.turboRemaining-5)<1e-7);
 tick(r,{},5);assert.equal(r.turboRemaining,0);assert.equal(r.speed,config.maxSpeed*2.5);
 tick(r,{throttle:1},2);assert.equal(r.speed,config.maxSpeed);
 assert.equal(boostTank(r),false);tick(r,{},48);assert.equal(r.turboCooldown,0);assert.equal(boostTank(r),true);tick(r,{throttle:-1},.5);assert.ok(r.speed<config.maxSpeed*2.5-8);
 r.crushed=true;step(r,{},1/60);assert.equal(r.turboRemaining,0);assert.equal(boostTank(r),false);
 assert.equal(createRun().turboRemaining,0);
});

test('moving-target stomp includes folding and falling time, then commits without tracking',async()=>{
 const {stompDuration,beginCrush,advanceCrush,resolveCrush}=await import('../src/simulation/crush.js');
 const time=stompDuration(80),tank={x:-1800,s:-1800,speed:22,events:[],crushed:false};
 const e={x:tank.x,s:tank.s+22*time,y:80,yaw:Math.PI,vx:0,vs:0,canSee:true,memory:{x:tank.x,s:tank.s,vx:0,vs:22,seenAt:0}};
 beginCrush(e,0);assert.ok(e.attack);const committed={...e.attack.target};
 for(let i=1;i<240&&!tank.crushed;i++){tank.s+=22/120;advanceCrush(e,i/120,1/120);resolveCrush(tank,e);}
 // Fold plus fall is longer than two seconds.
 for(let i=240;i<420&&!tank.crushed;i++){tank.s+=22/120;advanceCrush(e,i/120,1/120);resolveCrush(tank,e);}
 assert.equal(tank.crushed,true);assert.ok(Math.abs(tank.s-committed.s)<5.5);
 const miss={...e,attack:null,y:80,targetGone:false,nextAttack:0,canSee:true,memory:{x:-1800,s:-1800,vx:0,vs:22,seenAt:0}};
 beginCrush(miss,0);assert.ok(miss.attack);
 const escaping={x:-1750,s:-1800,events:[],crushed:false};
 for(let i=1;i<420;i++){advanceCrush(miss,i/120,1/120);resolveCrush(escaping,miss);}
 assert.equal(escaping.crushed,false);assert.equal(miss.x,-1800);
});

test('autonomous Recognizers intercept a tank moving at cruise speed',()=>{
 for(const lead of [60,100,160]){
  const r=createRun();Object.assign(r,{x:-1800,s:-1800,yaw:0,speed:22});
  r.recognizers=r.recognizers.slice(0,1);Object.assign(r.recognizers[0],{x:r.x,s:r.s+lead,y:80,yaw:Math.PI});
  for(let i=0;i<1200&&!r.crushed;i++)step(r,{throttle:1},1/60);
  assert.equal(r.crushed,true,`initial separation ${lead}`);
 }
});

test('additional patrols start scattered with no target; sight requires range and clearance',()=>{
 const r=createRun(),patrols=r.recognizers.slice(5);
 assert.equal(patrols.length,4);
 for(const e of patrols){assert.equal(e.state,'wander');assert.equal(e.memory,null);assert.equal(e.canSee,false);assert.ok(e.y>54);}
 assert.deepEqual(createRun().recognizers.slice(5),patrols);
 for(let i=0;i<patrols.length;i++)for(let j=i+1;j<patrols.length;j++)assert.ok(Math.hypot(patrols[i].x-patrols[j].x,patrols[i].s-patrols[j].s)>=150);
 const e={...patrols[0],x:-10000,s:-10000,y:80,yaw:0,nextSense:0};
 assert.equal(canSeeClu(e,{x:e.x,s:e.s+SENSORS.range-10}),true);
 const far={x:e.x,s:e.s+SENSORS.range+1,yaw:0,speed:0};
 perceive(e,far,1);assert.equal(e.canSee,false);assert.equal(e.memory,null);
 assert.equal(canSeeClu({...e,y:SENSORS.range+3},{x:e.x,s:e.s}),false);
});
