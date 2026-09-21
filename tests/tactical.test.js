import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/game/config.js';
import {createRun,startPursuit,step} from '../src/simulation/run.js';
import {WALLS,WALL_HEIGHT,freePosition,OPEN_CELLS} from '../src/levels/maze.js';
import {aircraftPoseClear,aircraftSweepClear,corridorRoute,overheadRoute,SAFE_ALTITUDE,AIR_HULL} from '../src/simulation/maneuver-geometry.js';
import {maneuverOptions,chooseManeuver,applyTacticalChoice,tacticalSnapshot} from '../src/simulation/tactical.js';
import {TACTICAL} from '../src/game/tactical.js';
const box=(x0,s0,x1,s1)=>({height:54,points:[{x:x0,s:s0},{x:x1,s:s0},{x:x1,s:s1},{x:x0,s:s1}]});
function mode(value,fn){const before=config.aiMode;config.aiMode=value;try{return fn();}finally{config.aiMode=before;}}
test('oriented footprint fits beside walls but rejects broadside turns and swept crossings',()=>{
 const walls=[box(-100,-50,100,0)],pose={x:0,s:6,y:22,yaw:0};
 assert.ok(aircraftPoseClear(pose,walls));assert.equal(aircraftPoseClear({...pose,yaw:Math.PI/2},walls),false);
 assert.equal(aircraftSweepClear(pose,{...pose,yaw:Math.PI},walls),false);
 assert.equal(aircraftSweepClear({...pose,s:-70},{...pose,s:30},walls),false);
 assert.ok(overheadRoute({...pose,yaw:0},{...pose,x:40},walls));
});
test('low corridor route checks descent, turns and every swept segment',()=>{
 const walls=[box(-100,-50,100,0),box(-100,14,100,70)];
 const start={x:-40,s:7,y:SAFE_ALTITUDE,yaw:Math.PI/2},goal={x:40,s:7,y:22,yaw:Math.PI/2};
 // Narrow depth requires the shoulders parallel to the corridor; this heading is too wide.
 assert.equal(corridorRoute(start,goal,walls),null);
 const wide=[box(-100,-50,100,0),box(-100,40,100,70)];
 const a={x:-40,s:20,y:SAFE_ALTITUDE,yaw:-Math.PI/2},b={x:40,s:20,y:22,yaw:-Math.PI/2},route=corridorRoute(a,b,wide);
 assert.ok(route);let previous=a;for(const p of route){assert.ok(aircraftSweepClear(previous,p,wide));previous=p;}assert.equal(route.at(-1).y,22);
});
test('tactical retains the full default roster; small encounter is opt-in and spawning stays suppressed',()=>{
 const classic=mode('classic',()=>createRun(1982));
 mode('jev',()=>{
  const full=createRun(1982);
  assert.deepEqual(full.recognizers,classic.recognizers);assert.deepEqual(full.enemyTanks,classic.enemyTanks);
  const before=config.aiSmallEncounter;
  try{
   config.aiSmallEncounter=true;
   const r=createRun(1982);assert.equal(r.recognizers.length,2);assert.equal(r.enemyTanks.length,1);
   r.pursuitSeconds=99;step(r,{},1/60);assert.equal(r.recognizers.length,2);assert.equal(r.pursuitSeconds,0);
  }finally{config.aiSmallEncounter=before;}
 });
});
test('wounded units favor withdrawal; snapshots are independent of hidden live Clu',()=>{
 mode('local',()=>{
  const a=createRun(1982),b=createRun(1982);Object.assign(b,{x:999999,s:-999999,speed:999,health:0});
  for(const r of [a,b]){const e=r.recognizers[0];Object.assign(e,{x:-5000,s:-5000,y:80,health:1,memory:{x:-5000,s:-4900,vx:0,vs:0,seenAt:0,source:e.id}});r.recognizers=[e];r.enemyTanks=[];chooseManeuver(e,0,[e]);}
  assert.equal(a.recognizers[0].tactical.plan.kind,'retreat');assert.deepEqual(a.recognizers[0].tactical.snapshot,b.recognizers[0].tactical.snapshot);
 });
});
test('remote choices reject stale revisions, uncertainty and arbitrary IDs',()=>{
 const r=createRun(1982),e=r.recognizers[0];Object.assign(e,{x:-5000,s:-5000,y:80,memory:{x:-5000,s:-4900,vx:0,vs:0,seenAt:0,source:e.id}});
 chooseManeuver(e,0,[e]);const t=e.tactical,choice={id:t.options[0].id,confidence:1};
 assert.equal(applyTacticalChoice(e,choice,t.revision+1,0,1),false);assert.equal(applyTacticalChoice(e,choice,t.revision,0,4),false);assert.equal(applyTacticalChoice(e,{...choice,confidence:.1},t.revision,0,1),false);assert.equal(applyTacticalChoice(e,{...choice,id:'invented'},t.revision,0,1),false);
 assert.ok(applyTacticalChoice(e,choice,t.revision,0,1));assert.equal(t.source,'jev');
});
test('wall-side maneuver can align and complete a stomp without intersecting a slab',()=>{
 mode('local',()=>{
  let site;
  for(const w of WALLS)for(const edge of w.edges){
   const x=(edge.a.x+edge.b.x)/2+edge.nx*6,s=(edge.a.s+edge.b.s)/2+edge.ns*6;
   for(let i=0;i<8;i++){const p={x,s,y:AIR_HULL.bottom,yaw:i*Math.PI/4};if(freePosition(x,s,3.5)&&!freePosition(x,s,14)&&aircraftPoseClear(p)){site=p;break;}}
   if(site)break;
  }
  assert.ok(site,'fixture must expose circle-clearance failure');
  const r=createRun(1982),e=r.recognizers[0];r.enemyTanks=[];r.recognizers=[e];r.dataBeams=[];Object.assign(r,{x:site.x,s:site.s,speed:0});
  Object.assign(e,{x:site.x,s:site.s,y:SAFE_ALTITUDE,yaw:site.yaw+Math.PI/2,vx:0,vs:0,vy:0,yawVelocity:0,nextSense:0,stompDisabled:false,memory:{x:site.x,s:site.s,vx:0,vs:0,seenAt:0,source:e.id},canSee:true});
  for(let i=0;i<2400&&!r.crushed;i++){step(r,{},1/60);assert.ok(aircraftPoseClear(e),`collision at ${r.time}`);}
  assert.ok(r.crushed,JSON.stringify({site,pose:{x:e.x,s:e.s,y:e.y,yaw:e.yaw},plan:e.tactical?.plan,index:e.tactical?.index}));
 });
});
test('local controller follows a low-altitude trajectory using bounded acceleration',async()=>{
 const {navigateTactical}=await import('../src/simulation/tactical.js');
 const e=createRun(1982).recognizers[0];Object.assign(e,{x:-5000,s:-5000,y:SAFE_ALTITUDE,yaw:0,vx:0,vs:0,vy:0,yawVelocity:0,memory:null,canSee:false});
 const goal={x:-5000,s:-4920,y:22,yaw:0},route=corridorRoute(e,goal);assert.ok(route);
 e.tactical={revision:1,index:0,started:0,nextPlan:100,plan:{id:'m0',kind:'low-cover',goal,route},target:null};
 let minimum=Infinity,previous={...e};
 for(let i=0;i<2400;i++){navigateTactical(e,i/60,1/60,[e]);minimum=Math.min(minimum,e.y);assert.ok(Math.abs(e.vy-previous.vy)<=14/60+1e-7);previous={...e};}
 assert.ok(minimum<23);assert.ok(Math.hypot(e.x-goal.x,e.s-goal.s)<1.3);assert.ok(Math.abs(e.y-goal.y)<.4);
});


test('all five opening pursuers close on a moving Clu without returning to their route origins',()=>{
 mode('local',()=>{
  const r=createRun(1982);startPursuit(r);
  const initial=r.recognizers.slice(0,5).map(e=>Math.hypot(e.x-r.x,e.s-r.s));
  for(let i=0;i<720;i++)step(r,{throttle:1},1/60);
  for(const [i,e] of r.recognizers.slice(0,5).entries()){
   assert.ok(Math.hypot(e.x-r.x,e.s-r.s)<initial[i]-40,`unit ${i} must close on moving contact`);
   assert.ok(Math.hypot(e.vx,e.vs)>config.maxSpeed,`unit ${i} must maintain pursuit speed`);
   assert.equal(e.tactical.plan.kind,'pursue');
  }
 });
});


function pursuitFixture(){
 const e=createRun(1982).recognizers[0];
 Object.assign(e,{x:-5000,s:-5000,y:SAFE_ALTITUDE,yaw:0,vx:0,vs:25,vy:0,yawVelocity:0,canSee:true,memory:{x:-5000,s:-4800,vx:0,vs:22,seenAt:0}});
 chooseManeuver(e,0,[e]);return e;
}
test('sight loss interrupts commitment, reacquisition is debounced, and obsolete Jev replies are rejected',()=>{
 const e=pursuitFixture(),old=e.tactical.revision,answer={id:e.tactical.options[0].id,confidence:1};
 e.canSee=false;
 assert.equal(applyTacticalChoice(e,answer,old,0,.2),false);
 const motion={vx:e.vx,vs:e.vs,yawVelocity:e.yawVelocity};
 chooseManeuver(e,.2,[e]);assert.equal(e.tactical.revision,old+1);assert.equal(e.tactical.reason,'sight-lost');assert.equal(e.tactical.plan.kind,'search-track');
 assert.deepEqual({vx:e.vx,vs:e.vs,yawVelocity:e.yawVelocity},motion);
 e.canSee=true;chooseManeuver(e,.3,[e]);assert.equal(e.tactical.revision,old+1);
 chooseManeuver(e,.9,[e]);assert.equal(e.tactical.revision,old+2);assert.equal(e.tactical.reason,'sight-regained');
});
test('observed turns, stops, position changes and radio acquisition trigger fresh plans',()=>{
 for(const patch of [{vx:22,vs:0},{vx:0,vs:0},{s:-4700}]){
  const e=pursuitFixture(),revision=e.tactical.revision;Object.assign(e.memory,patch,{seenAt:.2});
  chooseManeuver(e,.2,[e]);assert.equal(e.tactical.revision,revision+1);assert.match(e.tactical.reason,/target-(maneuver|moved)/);
 }
 const e=pursuitFixture();e.memory=null;e.canSee=false;e.tactical=null;chooseManeuver(e,0,[e]);const revision=e.tactical.revision;
 e.memory={x:-5000,s:-4800,vx:0,vs:22,seenAt:.2};chooseManeuver(e,.2,[e]);
 assert.equal(e.tactical.revision,revision+1);assert.equal(e.tactical.reason,'contact-reported');
});
test('lost-contact search keeps closing without inventing a new sighting or attack',async()=>{
 const {navigateTactical}=await import('../src/simulation/tactical.js');
 const e=pursuitFixture();e.canSee=false;chooseManeuver(e,.2,[e]);
 const goal={...e.tactical.plan.goal},before=Math.hypot(e.x-goal.x,e.s-goal.s);
 for(let i=0;i<600;i++)navigateTactical(e,.2+i/60,1/60,[e]);
 assert.ok(Math.hypot(e.x-goal.x,e.s-goal.s)<before-100);assert.ok(!e.attack);assert.equal(e.canSee,false);assert.equal(e.memory.s,-4800);
});
test('at the last-known location, healthy units search nearby branches instead of waiting',()=>{
 const p=OPEN_CELLS[0],e=pursuitFixture();Object.assign(e,{x:p.x,s:p.s,canSee:false,memory:{x:p.x,s:p.s,vx:0,vs:0,seenAt:0},tactical:null});
 chooseManeuver(e,1,[e]);assert.equal(e.tactical.plan.kind,'search-branch');
 assert.ok(Math.hypot(e.tactical.plan.goal.x-p.x,e.tactical.plan.goal.s-p.s)>TACTICAL.searchArrivalMeters);
 e.health=1;chooseManeuver(e,1.1,[e]);assert.equal(e.tactical.plan.kind,'retreat');
});

test('search hypotheses follow connected corridors around corners, excluding disconnected pockets',async()=>{
 const {connectedSearchRoutes}=await import('../src/simulation/search-routes.js');
 const inside=p=>(p.x>=-12&&p.x<=68&&Math.abs(p.s)<=12)||(Math.abs(p.x-56)<=12&&p.s>=-12&&p.s<=84)||(p.x>=-64&&p.x<=-40&&p.s>=40&&p.s<=64);
 const clear=(a,b)=>{for(let i=0;i<=16;i++)if(!inside({x:a.x+(b.x-a.x)*i/16,s:a.s+(b.s-a.s)*i/16}))return false;return true;};
 const routes=connectedSearchRoutes({x:0,s:0},{radius:160,step:8,limit:1000,clear});
 const aroundCorner=routes.find(p=>p.x===56&&p.s===64);assert.ok(aroundCorner);assert.equal(clear({x:0,s:0},aroundCorner),false);
 for(let i=1;i<aroundCorner.path.length;i++)assert.ok(clear(aroundCorner.path[i-1],aroundCorner.path[i]));
 assert.ok(!routes.some(p=>p.x<-20&&p.s>30));
});
test('aircraft continues inspecting multiple connected locations after reaching last contact',async()=>{
 const {navigateTactical}=await import('../src/simulation/tactical.js');
 const p=OPEN_CELLS[0],e=pursuitFixture();Object.assign(e,{x:p.x,s:p.s,y:SAFE_ALTITUDE,vx:0,vs:0,canSee:false,memory:{x:p.x,s:p.s,vx:0,vs:0,seenAt:0},tactical:null});
 for(let i=0;i<2100;i++){
  navigateTactical(e,i/60,1/60,[e]);
  assert.notEqual(e.tactical.plan?.kind,'search-track');assert.ok(!e.attack);
 }
 assert.ok(e.tactical.search.originChecked);assert.ok(e.tactical.search.visited.length>=4,JSON.stringify(e.tactical.search.visited));
 assert.ok(e.tactical.options.some(o=>o.kind==='search-branch'&&o.searchPath.length>1));
 assert.equal(e.memory.seenAt,0);assert.equal(e.canSee,false);
});
test('ground search records completed checks and does not return to the last-known anchor',()=>{
 const p=OPEN_CELLS[0],e=pursuitFixture();Object.assign(e,{kind:'ground',x:p.x,s:p.s,y:3.8,canSee:false,memory:{x:p.x,s:p.s,vx:0,vs:0,seenAt:0},tactical:null});
 let goal=chooseManeuver(e,0,[e]);assert.equal(goal.kind,'search-branch');
 Object.assign(e,{x:goal.goal.x,s:goal.goal.s});goal=chooseManeuver(e,1,[e]);
 assert.equal(goal.kind,'search-branch');assert.equal(e.tactical.search.visited.length,2);
 assert.ok(Math.hypot(e.x-goal.goal.x,e.s-goal.goal.s)>TACTICAL.searchVisitMeters);
 assert.equal(e.nextRoute,0);
});
