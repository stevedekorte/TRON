import test from 'node:test';
import assert from 'node:assert/strict';
import {RemotePlayback,remotePose,presentRemoteCycles,REMOTE_PLAYBACK} from '../../src/multiplayer/remote-playback.js';
import {MP} from '../../shared/multiplayer/config.js';

const bike=(overrides={})=>({id:0,alive:true,x:0,z:0,dir:1,turns:0,segment:0,...overrides});
const state=(tick,round=1)=>({tick,race:{round,phase:'racing',cycles:[bike({x:tick/MP.tickHz*8})],trails:[{bikeId:0,dir:1,x1:0,z1:0,x2:tick/MP.tickHz*8,z2:0}]}});

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
