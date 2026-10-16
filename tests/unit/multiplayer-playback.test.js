import test from 'node:test';
import assert from 'node:assert/strict';
import {RemotePlayback,remotePose,presentRemoteCycles,REMOTE_PLAYBACK} from '../../src/multiplayer/remote-playback.js';
import {MP} from '../../shared/multiplayer/config.js';
import {MultiplayerClient,PREDICTION_CLOCK} from '../../src/multiplayer/client.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';

test('followed local cycle does not pull the camera backward on jittery snapshots',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 const client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{rtt:80,pending:[],me:{seat:0},control:{turbo:false,brake:false}});
 const run={cycleRace:{round:-1,site:{x:0,s:0}}},packets=[];
 const speed=C.speedMetersPerSecond/C.cellMeters,delays=[20,50,15,45,25,40];
 for(let i=0;i<50;i++){
  const s=state(i*6);s.clients=[{seat:0}];s.race.cycles=[0,1].map(id=>bike({id,x:i*.05*speed,z:id*3,segment:id,speedMultiplier:1,turboCharge:1,brakeCharge:1}));
  s.race.trails=s.race.cycles.map(b=>({bikeId:b.id,dir:1,x1:0,z1:b.z,x2:b.x,z2:b.z}));
  packets.push({arrival:i*50+delays[i%delays.length],state:s});
 }
 let index=0,previous=null,oldPrevious=null,oldWorstBackward=0,worstStepError=0;
 for(now=0;now<2400;now+=1000/144){
  while(index<packets.length&&packets[index].arrival<=now){const p=packets[index++];client.state=p.state;client.received=p.arrival;}
  if(!client.state)continue;
  client.rtt=now<1000?80:500;
  client.apply(run);const x=run.cycleRace.cycles[0].x;
  const oldX=(client.state.tick/MP.tickHz+(now-client.received+client.rtt/2)/1000)*speed;
  if(previous!==null&&now>250){
   assert(x>previous,'the local follow target must not jump backward');
   assert(x-previous<=speed/144*1.101,'packet arrivals must not lurch the camera forward');
   oldWorstBackward=Math.max(oldWorstBackward,oldPrevious-oldX);
   worstStepError=Math.max(worstStepError,Math.abs(x-previous-speed/144));
  }
  previous=x;oldPrevious=oldX;
 }
 // A round restart must reset time instead of carrying prediction into the new round.
 client.state=state(1,2);client.received=now;
 assert.equal(client.estimatedRenderTick(),1+Math.min(client.rtt/2*MP.tickHz/1000,MP.maxFutureTicks-PREDICTION_CLOCK.reserveSnapshots*MP.snapshotTicks));
 console.log(JSON.stringify({followCameraJitter:{oldWorstBackwardMeters:oldWorstBackward*C.cellMeters,newWorstStepErrorMeters:worstStepError*C.cellMeters}}));
});

const bike=(overrides={})=>({id:0,alive:true,x:0,z:0,dir:1,turns:0,segment:0,...overrides});
const state=(tick,round=1)=>({tick,race:{round,phase:'racing',cycles:[bike({x:tick/MP.tickHz*8})],trails:[{bikeId:0,dir:1,x1:0,z1:0,x2:tick/MP.tickHz*8,z2:0}]}});

test('first-load rendering pause rebases both clocks instead of stepping at packet frequency',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 const remote=new RemotePlayback(),client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{state:state(0),received:0,rtt:80});
 remote.push(client.state,now);remote.sample(now);client.estimatedRenderTick();
 // The socket keeps receiving while the first arena compiles/loads for two seconds.
 for(now=50;now<=2000;now+=50){client.state=state(now*MP.tickHz/1000);client.received=now;remote.push(client.state,now);}
 now=2000;let local=client.estimatedRenderTick(),sample=remote.sample(now);
 assert(Math.abs(local-(240+4.8))<1e-9,'local clock catches up before rendering resumes');
 assert(Math.abs(sample.tick-(240-REMOTE_PLAYBACK.bufferSeconds*MP.tickHz))<1e-9,'remote clock resumes inside its buffer');
 let playbackTick=sample.tick;
 for(now=2000+1000/144;now<2400;now+=1000/144){
  const tick=Math.floor(now/50)*6;
  if(tick>client.state.tick){client.state=state(tick);client.received=tick/MP.tickHz*1000;remote.push(client.state,client.received);}
  const nextLocal=client.estimatedRenderTick(),nextRemote=remote.sample(now).tick;
  for(const step of [nextLocal-local,nextRemote-playbackTick])assert(step>0&&step<=MP.tickHz/144*1.101,'resumed motion remains continuous');
  local=nextLocal;playbackTick=nextRemote;
 }
});

test('straight remote motion stays continuous across jittery packet arrivals',()=>{
 const playback=new RemotePlayback(),packets=[];
 const delays=[20,50,15,45,25,40];
 for(let i=0;i<50;i++)packets.push({arrival:i*50+delays[i%delays.length],state:state(i*6)});
 let index=0,lastX=null,maxJump=0,oldLast=null,oldMaxJump=0;
 for(let now=0;now<2400;now+=1000/144){
  while(index<packets.length&&packets[index].arrival<=now){playback.push(packets[index].state,packets[index].arrival);index++;}
  const sample=playback.sample(now);if(!sample)continue;
  const pose=remotePose(sample.a.race.cycles[0],sample.b.race.cycles[0],sample.b.race.trails,sample.fraction);
  const latest=packets[index-1],oldX=(latest.state.tick+(now-latest.arrival)*MP.tickHz/1000+MP.inputLeadTicks)/MP.tickHz*8;
  if(now>250&&lastX!==null){
   const step=pose.x-lastX;assert(step>0,'no backward jump or held frame on the straight');
   assert(step<=8/144*(1+REMOTE_PLAYBACK.maxRateAdjustment)+1e-9,'bounded per-frame travel');
   maxJump=Math.max(maxJump,Math.abs(step-8/144));oldMaxJump=Math.max(oldMaxJump,Math.abs(oldX-oldLast-8/144));
  }
  lastX=pose.x;oldLast=oldX;
 }
 assert(maxJump<oldMaxJump*.1,'at least 90% reduction in worst straight-line frame-step error');
 console.log(JSON.stringify({jitterPlayback:{oldWorstErrorMeters:oldMaxJump*4.8,newWorstErrorMeters:maxJump*4.8}}));
});

test('buffer follows two exact corners rather than cutting diagonally',()=>{
 const trails=[{bikeId:0,dir:1,x1:0,z1:0,x2:1,z2:0},{bikeId:0,dir:2,x1:1,z1:0,x2:1,z2:1},{bikeId:0,dir:3,x1:1,z1:1,x2:0,z2:1}];
 const a=bike(),b=bike({x:0,z:1,dir:3,turns:2,segment:2});
 const poses=[1/6,.5,5/6].map(f=>remotePose(a,b,trails,f));
 assert.deepEqual(poses.map(p=>[p.x,p.z,p.dir,p.segment]),[[.5,0,1,0],[1,.5,2,1],[.5,1,3,2]]);
 const race={round:1,cycles:[{...b},bike({id:1,x:9,segment:3}),bike({id:2,alive:false,segment:4})],trails:[...trails,{bikeId:1,x1:8,z1:0,x2:9,z2:0},{bikeId:2,x1:0,z1:2,x2:3,z2:2}]};
 const sample={a:{race:{cycles:[a]}},b:{race:{round:1,phase:'racing',cycles:[b],trails}},fraction:.5};
 const saved=structuredClone(sample);presentRemoteCycles(race,sample,1);
 assert.deepEqual([race.cycles[0].x,race.cycles[0].z],[1,.5]);
 const remoteTrails=race.trails.filter(t=>t.bikeId===0);assert.equal(remoteTrails.length,2);assert.equal(remoteTrails[1].z2,.5);
 assert.equal(race.trails[race.cycles[0].segment],remoteTrails[1]);
 assert.equal(race.trails[race.cycles[1].segment].bikeId,1);assert.equal(race.cycles[1].x,9,'local prediction untouched');
 assert.equal(race.cycles[2].alive,false);assert.equal(race.trails[race.cycles[2].segment].bikeId,2,'dead trails preserved');
 assert.deepEqual(sample,saved,'history stays immutable');
});

test('playback holds at last confirmed pose on stalls, bounds history and resets for new rounds',()=>{
 const playback=new RemotePlayback();
 for(let i=0;i<200;i++){playback.push(state(i*6),i*50);playback.sample(i*50);}
 assert(playback.frames.length<=12);
 const last=playback.frames.at(-1).state.tick;
 for(let now=10000;now<11000;now+=16)assert(playback.sample(now).tick<=last);
 assert.equal(playback.sample(11000).tick,last);
 playback.push(state(last-6),11001);assert.equal(playback.frames.at(-1).state.tick,last);
 playback.push(state(1,2),11002);assert.equal(playback.frames.length,1);assert.equal(playback.sample(11002).tick,1);
 playback.reset();assert.equal(playback.sample(11003),null);
});

test('a long render pause cannot rewind a remote cycle when the server also stalls',()=>{
 const playback=new RemotePlayback();
 for(let now=0;now<=1000;now+=10){if(now%50===0)playback.push(state(now*MP.tickHz/1000),now);playback.sample(now);}
 // Keep rendering briefly without packets, then pause the renderer as well.
 // Rebasing to the old snapshot minus the buffer must not undo displayed travel.
 const before=playback.sample(1080).tick;
 playback.push(state(126),1320);
 const resumed=playback.sample(1320).tick;
 assert(resumed>=before,'a frame stall must not move a remote cycle backward');
 playback.push(state(132),1330);
 assert(playback.sample(1330).tick>=resumed,'the next snapshot must preserve monotonic playback');
});


test('local follow clock cannot rewind after a combined render and server stall',t=>{
 let now=1000;t.mock.method(performance,'now',()=>now);
 const client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{state:state(120),received:1000,rtt:80});client.estimatedRenderTick();
 now=1080;const before=client.estimatedRenderTick();
 now=1320;client.state=state(126);client.received=now;
 assert(client.estimatedRenderTick()>=before,'camera time cannot step backwards when slow server resumes');
});
