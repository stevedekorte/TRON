import {DATA_BEAM} from '../src/simulation/data-beams.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Autoplay,visibleAutoplayEnemies} from '../src/simulation/autoplay.js';
import {createRun,step} from '../src/simulation/run.js';
import {config} from '../src/game/config.js';
import {JevClient} from '../src/ai/jev-client.js';
import {jevQuestion} from '../shared/jev-protocol.js';
import {WALLS,lineOfSight,OPEN_CELLS,freePosition} from '../src/levels/maze.js';
import {chooseManeuver} from '../src/simulation/tactical.js';
const scenario=()=>{const r=createRun(1982);Object.assign(r,{x:-5000,s:-5000,yaw:0,speed:0,recognizers:[],enemyTanks:[],dataBeams:[]});return r;};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('autoplay starts off and drives with real inputs without enemies or provider',()=>{
 const a=new Autoplay(),r=scenario();assert.equal(a.enabled,false);assert.deepEqual(a.input(r),{});
 a.setEnabled(true);for(let i=0;i<600;i++)step(r,a.input(r),1/60);
 assert.ok(Math.hypot(r.x+5000,r.s+5000)>80);assert.ok(r.speed>0);assert.equal(r.shots,0);assert.equal(a.tactical.source,'local');
 assert.equal(jevQuestion(a.tactical.snapshot).questions.maneuver.instructions.startsWith('Control CLU'),true);
});
test('only unobstructed contacts enter player requests; enemy intentions are omitted',()=>{
 const r=scenario(),wall=WALLS[0],edge=wall.edges[0],x=(edge.a.x+edge.b.x)/2,s=(edge.a.s+edge.b.s)/2;
 Object.assign(r,{x:x+edge.nx*10,s:s+edge.ns*10});
 const e={id:100,kind:'ground',health:3,state:'pursue',x:x-edge.nx*10,s:s-edge.ns*10,yaw:0,memory:{private:true},tactical:{private:true}};
 assert.equal(lineOfSight({...r,y:2.8},{...e,y:2.3}),false);r.enemyTanks=[e];assert.deepEqual(visibleAutoplayEnemies(r),[]);
 Object.assign(e,{x:r.x,s:r.s});const [seen]=visibleAutoplayEnemies(r);assert.equal(seen.id,100);assert.equal(seen.memory,undefined);assert.equal(seen.tactical,undefined);
});
test('stale, invalid, disabled and pre-teleport answers cannot take over',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);const t=a.tactical,answer={id:t.options[0].id,confidence:1};
 assert.equal(a.apply({...answer,id:'invented'},t.revision,0,r),false);
 assert.equal(a.apply(answer,t.revision,0,r),true);assert.equal(a.tactical.source,'jev');
 r.teleportRevision++;assert.equal(a.apply(answer,t.revision,0,r),false);a.input(r);assert.notEqual(a.tactical.revision,t.revision);
 a.setEnabled(false);assert.equal(a.apply(answer,t.revision,0,r),false);
});
test('player Jev requests work with Classic enemies and stop on manual disable',async()=>{
 const before=config.aiMode;config.aiMode='classic';const a=new Autoplay(),r=scenario();let calls=0,resolve;
 const client=new JevClient((_url,init)=>{calls++;assert.equal(JSON.parse(init.body).controller,'clu');return new Promise(r=>resolve=r);});
 try{
  a.setEnabled(true);a.input(r);client.update(r,true,a);assert.equal(calls,1);
  const answer={id:a.tactical.options[0].id,confidence:1};resolve(Response.json(answer));await flush();assert.equal(a.tactical.source,'jev');assert.equal(client.history[0].unit,'clu');
  a.setEnabled(false);r.time+=4;client.update(r,true,a);assert.equal(calls,1);
 }finally{config.aiMode=before;client.dispose();}
});
test('player and enemy decisions share one serialized scheduler without starving enemies',async()=>{
 const before=config.aiMode;config.aiMode='jev';const r=scenario(),a=new Autoplay(),e=createRun(1982).recognizers[0],controllers=[];
 Object.assign(e,{x:r.x+100,s:r.s,y:80,memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:0}});r.recognizers=[e];chooseManeuver(e,0,[e]);a.setEnabled(true);a.input(r);
 const client=new JevClient(async(_url,init)=>{const state=JSON.parse(init.body);controllers.push(state.controller||'enemy');return Response.json({id:state.options[0].id,confidence:1});});
 try{client.update(r,true,a);client.update(r,true,a);assert.equal(controllers.length,1);await flush();r.time=.7;client.update(r,true,a);assert.equal(controllers.length,1);await new Promise(resolve=>setTimeout(resolve,660));client.update(r,true,a);await flush();assert.deepEqual(controllers,['clu','enemy']);}
 finally{config.aiMode=before;client.dispose();}
});
test('cruising hands off short routes without repeated near-stops',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);let minimum=Infinity;
 for(let i=0;i<1200;i++){step(r,a.input(r),1/60);if(i>240)minimum=Math.min(minimum,r.speed);}
 assert.ok(minimum>19,`cruise speed dipped to ${minimum}`);
});
test('turret reacquires route direction when no enemy target remains',()=>{
 const a=new Autoplay(),r=scenario();r.turretYaw=Math.PI/2;r.turretHeading=Math.PI/2;a.setEnabled(true);
 for(let i=0;i<360;i++)step(r,a.input(r),1/60);
 assert.ok(Math.abs(r.turretYaw)<.03,`turret stayed at ${r.turretYaw}`);
});
test('collinear route waypoints keep momentum but the data destination still stops',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);r.speed=22;
 const path=[{x:r.x,s:r.s+20},{x:r.x,s:r.s+80}];Object.assign(a.tactical,{nextPlan:Infinity,plan:{id:'fixture',kind:'collect-data',goal:path[1],route:path}});a.follower.accept(a.tactical.plan,a.tactical.revision,r);
 let waypointSpeed=0;
 for(let i=0;i<600;i++){step(r,a.input(r),1/60);if(r.s>-4981&&r.s<-4979)waypointSpeed=r.speed;}
 assert.ok(waypointSpeed>19,`waypoint speed ${waypointSpeed}`);assert.ok(Math.abs(r.s-path[1].s)<7);assert.ok(Math.abs(r.speed)<.3);
});
test('player snapshot and prompt explicitly describe completing every beam and waiting for blue',()=>{
 const a=new Autoplay(),r=scenario();r.time=10;r.dataBeams=[{id:0,x:r.x,s:r.s,collectedAt:2,transferStartedAt:0},{id:1,x:r.x+10,s:r.s,collectedAt:null,transferStartedAt:5},{id:2,x:r.x+100,s:r.s,collectedAt:null,transferStartedAt:null}];
 a.setEnabled(true);a.input(r);const snapshot=a.tactical.snapshot;
 assert.equal(snapshot.objective.remaining,2);assert.equal(snapshot.objective.total,3);assert.equal(snapshot.objective.transferSeconds,DATA_BEAM.transferSeconds);
 assert.deepEqual(snapshot.objectives.map(b=>b.state),['blue','transitioning','red']);assert.equal(snapshot.objectives[1].remainingTransferSeconds,DATA_BEAM.transferSeconds-5);
 const prompt=jevQuestion(snapshot).questions.maneuver.instructions;assert.match(prompt,/turn every red data beam blue/);assert.match(prompt,/remain there until the transfer completes/);
});
test('service failures disengage autoplay and recovery never automatically re-enables it',async()=>{
 const before=config.aiMode;config.aiMode='classic';
 try{
  for(const failure of ['network','http','limit']){
   const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);r.cruiseThrottle=true;
   const client=new JevClient(async()=>{
    if(failure==='network')throw new TypeError('Failed to fetch');
    if(failure==='timeout')throw new DOMException('Aborted','AbortError');
    return new Response(JSON.stringify({error:'Unavailable'}),{status:failure==='limit'?429:503,headers:{'Retry-After':failure==='limit'?'60':'0'}});
   });
   client.update(r,true,a);await flush();
   assert.equal(a.enabled,false,failure);assert.equal(a.tactical,null);assert.equal(r.cruiseThrottle,false);assert.match(client.warning.detail,/Autoplay disengaged/);
   client.update(r,true,a);assert.equal(a.enabled,false);
   if(failure==='limit'){a.setEnabled(true);client.update(r,true,a);assert.equal(a.enabled,false,'known cooldown cannot run the local pilot');}
   client.dispose();
  }
 }finally{config.aiMode=before;}
});
test('pausing a pending request does not disengage autoplay',async()=>{
 const before=config.aiMode;config.aiMode='classic';
 const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);
 const client=new JevClient((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
 try{client.update(r,true,a);client.update(r,false,a);await flush();assert.equal(a.enabled,true);assert.equal(client.warning,null);}
 finally{client.dispose();config.aiMode=before;}
});
test('peaceful pilot pursues distant red beams and retains its destination across replans',()=>{
 const a=new Autoplay(),r=scenario();r.dataBeams=[{id:1,x:-5000,s:-4300,collectedAt:null,transferStartedAt:null},{id:2,x:-4700,s:-5800,collectedAt:null,transferStartedAt:null}];
 a.setEnabled(true);a.input(r);assert.equal(a.mission.objectiveId,1);assert.deepEqual(a.tactical.options.map(o=>o.kind),['collect-data']);
 const initial=Math.hypot(r.x+5000,r.s+4300);
 for(let i=0;i<600;i++)step(r,a.input(r),1/60);
 assert(Math.hypot(r.x+5000,r.s+4300)<initial-100);
 Object.assign(r,{x:-4700,s:-5790});a.plan(r);assert.equal(a.mission.objectiveId,1,'nearer alternative does not cause destination switching');
 r.dataBeams[0].collectedAt=r.time;a.input(r);assert.equal(a.mission.objectiveId,2);assert.equal(a.tactical.snapshot.objective.activeBeamId,2);
 r.transferActive=true;a.plan(r);assert.deepEqual(a.tactical.options.map(o=>o.kind),['hold']);
});
test('all beam colors include distance and hull-relative direction',()=>{
 const a=new Autoplay(),r=scenario();r.dataBeams=[{id:0,x:r.x+100,s:r.s,collectedAt:0,transferStartedAt:null},{id:1,x:r.x,s:r.s+900,collectedAt:null,transferStartedAt:null}];
 a.setEnabled(true);a.input(r);const beams=a.tactical.snapshot.objectives;
 assert.equal(beams[0].state,'blue');assert.equal(beams[0].distanceMeters,100);assert(Math.abs(beams[0].bearingRadians-Math.PI/2)<1e-9);
 assert.equal(beams[1].state,'red');assert.equal(beams[1].distanceMeters,900);assert(Math.abs(beams[1].bearingRadians)<1e-9);
});
test('unopposed pilot captures beams across separate authored mazes',()=>{
 const r=createRun(1982),a=new Autoplay();r.recognizers=[];r.enemyTanks=[];a.setEnabled(true);
 for(let i=0;i<36000&&r.dataBeams.filter(b=>b.collectedAt!==null).length<2;i++)step(r,a.input(r),1/60);
 assert(r.dataBeams.filter(b=>b.collectedAt!==null).length>=2);
 a.input(r);assert.notEqual(a.mission.objectiveId,null);
});
test('same Jev choice preserves waypoint progress',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);const t=a.tactical;const beforeIndex=a.follower.index;
 assert(a.apply({id:t.plan.id,confidence:1},t.revision,r.time,r));assert.equal(t.index,beforeIndex);
});
test('nearby uncollected beam replaces a distant commitment',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);a.mission.objectiveId=2;
 r.dataBeams=[{id:1,x:r.x,s:r.s+100,collectedAt:null,transferStartedAt:null},{id:2,x:r.x+5000,s:r.s,collectedAt:null,transferStartedAt:null}];
 a.plan(r);assert.equal(a.mission.objectiveId,1);
});
test('turbo accelerates on long clear runs but not short approaches or tight turns',()=>{
 const a=new Autoplay(),r=scenario();a.setEnabled(true);r.speed=20;
 r.dataBeams=[{id:1,x:r.x,s:r.s+2000,collectedAt:null,transferStartedAt:null}];
 const input=a.input(r);assert(input.turbo);step(r,input,1/60);assert(r.turboRemaining>0);
 for(let i=0;i<180;i++)step(r,a.input(r),1/60);assert(r.speed>30);
 const b=new Autoplay(),short=scenario();b.setEnabled(true);short.speed=20;short.dataBeams=[{id:1,x:short.x,s:short.s+50,collectedAt:null,transferStartedAt:null}];assert.equal(b.input(short).turbo,false);
 short.yaw=Math.PI/2;b.plan(short);assert.equal(b.input(short).throttle,-1);assert.equal(b.input(short).turbo,false);
});

test('room route reaches local beam through corners with repeated Jev confirmations',()=>{
 const p=OPEN_CELLS.filter(p=>p.mazeId===0&&freePosition(p.x,p.s,8))[60],r=createRun(1982),a=new Autoplay();
 Object.assign(r,{x:p.x,s:p.s,speed:0,yaw:0,recognizers:[],enemyTanks:[]});a.setEnabled(true);
 for(let i=0;i<5400&&r.dataBeams[0].collectedAt===null;i++){
  const input=a.input(r),t=a.tactical;
  if(i%42===0)a.apply({id:t.plan.id,confidence:1},t.revision,r.time,r);
  step(r,input,1/60);
 }
 assert.notEqual(r.dataBeams[0].collectedAt,null);
});
test('destroying five pursuers immediately cancels escape and rejects late escape replies',()=>{
 const r=scenario(),a=new Autoplay();r.dataBeams=[{id:0,x:r.x,s:r.s-600,collectedAt:null,transferStartedAt:null}];
 r.recognizers=Array.from({length:5},(_,i)=>({id:i,health:3,state:'pursue',x:r.x+20+i*5,s:r.s,y:70,vx:-5,vs:0,yaw:0}));
 a.setEnabled(true);a.input(r);const t=a.tactical,escape=t.options.find(o=>o.kind==='evade-and-engage');assert(escape);a.apply({id:escape.id,confidence:1},t.revision,r.time,r);
 r.recognizers.forEach(e=>{e.health=0;e.state='destroyed';});
 assert.equal(a.apply({id:escape.id,confidence:1},t.revision,r.time,r),false);
 a.input(r);assert.equal(a.tactical.plan.kind,'collect-data');assert(a.tactical.revision>t.revision);
 const initial=Math.abs(r.s-r.dataBeams[0].s);for(let i=0;i<1200;i++)step(r,a.input(r),1/60);
 assert(Math.abs(r.s-r.dataBeams[0].s)<initial-100);
});
test('distant nonapproaching visible enemies do not keep the pilot fleeing',()=>{
 const r=scenario(),a=new Autoplay();r.dataBeams=[{id:0,x:r.x,s:r.s+500,collectedAt:null,transferStartedAt:null}];
 r.recognizers=[{id:1,health:3,state:'patrol',x:r.x+300,s:r.s,y:70,vx:10,vs:0,yaw:0}];
 a.setEnabled(true);a.input(r);assert.equal(a.tactical.snapshot.visibleEnemies.length,1);assert.deepEqual(a.tactical.snapshot.threatIds,[]);assert.deepEqual(a.tactical.options.map(o=>o.kind),['collect-data']);
});
test('temporarily unavailable objective routes do not enable a walk into empty space',()=>{
 const r=scenario(),a=new Autoplay();r.dataBeams=[{id:0,x:r.x,s:r.s+500,collectedAt:null,transferStartedAt:null}];a.setEnabled(true);a.input(r);
 a.mission.objectiveFailures.set(0,r.time+15);a.mission.objectiveRoute=null;a.plan(r);
 assert.deepEqual(a.tactical.options.map(o=>o.kind),['hold']);
 r.time+=16;a.plan(r);assert.equal(a.tactical.plan.kind,'collect-data');
});
test('timeouts retry twice, recover, count attempts, and eventually disengage',async()=>{
 const before=config.aiMode;config.aiMode='classic';const a=new Autoplay(),r=scenario();a.setEnabled(true);a.input(r);let fail=true;
 const client=new JevClient(async()=>fail?Response.json({error:'Jev timed out'},{status:502}):Response.json({id:a.tactical.options[0].id,confidence:1,usage:{input_tokens:100}}));
 const attempt=async()=>{client.policy.nextRequestMs=0;client.policy.next=0;a.tactical.requested=null;client.update(r,true,a);await flush();};
 try{
  await attempt();assert(a.enabled);assert.equal(client.warning.label,'JEV RETRY');assert.equal(client.policy.timeoutFailures,1);assert(client.policy.nextRequestMs>Date.now());
  await attempt();assert(a.enabled);assert.equal(client.policy.timeoutFailures,2);
  fail=false;await attempt();assert(a.enabled);assert.equal(client.policy.timeoutFailures,0);assert.equal(client.warning,null);assert.equal(client.stats.value.requests,3);
  client.resetScheduling();assert.equal(client.stats.value.requests,3);fail=true;
  await attempt();await attempt();await attempt();assert.equal(a.enabled,false);assert.equal(client.stats.value.requests,6);
  client.update(scenario(),false,a);assert.equal(client.stats.value.requests,0);
 }finally{config.aiMode=before;client.dispose();}
});
