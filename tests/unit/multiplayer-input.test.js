import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {MP} from '../../shared/multiplayer/config.js';
import {MultiplayerClient} from '../../src/multiplayer/client.js';
import {LIGHT_CYCLES as C} from '../../shared/simulation/config/light-cycles.js';
import {ARENA_WALL} from '../../shared/simulation/config/arena-breaches.js';

function nearWall(speed,clearance=1.8){
 const room=new CycleRoom();room.join('driver');room.race.cameraStaging=false;room.race.materializing=true;room.race.remaining=0;room.step();
 const me=room.clients.get('driver'),b=room.race.cycles[me.seat];
 // Existing outer wall; no other cycle or changing trail near the approach.
 for(const cycle of room.race.cycles)cycle.human=true;
 Object.assign(b,{x:(ARENA_WALL.innerMeters-ARENA_WALL.cycleRadiusMeters-clearance)/C.cellMeters,z:0,dir:1,previousZ:0,speedMultiplier:speed,boosting:speed>1,turboCharge:1});
 b.previousX=b.x;room.race.trails=[];b.segment=undefined;
 me.control={turbo:speed>1,brake:false};
 return {room,me,b};
}
const command=(room,speed)=>({type:'input',round:room.race.round,seq:1,tick:room.tick,turn:1,turbo:speed>1,brake:false});

test('received turns apply next tick even with a future clock estimate; no timestamp can backdate death',()=>{
 for(const speed of [1,C.turboSpeedMultiplier]){
  const {room,me,b}=nearWall(speed),tick=room.tick,x=b.x;
  assert(room.input('driver',{...command(room,speed),tick:tick+8}));
  assert.equal(me.inputs[0].at,tick+1);
  room.step();assert.equal(b.dir,2);assert(b.alive);assert.equal(me.ack,1);
  assert(Math.abs(b.x-x)<1e-9,'turn occurs before advancing toward the wall');
  for(let i=0;i<12;i++)room.step();assert(b.alive,'cycle clears the fixed wall');
 }
 const {room,b}=nearWall(C.turboSpeedMultiplier);for(let i=0;i<6;i++)room.step();assert(!b.alive);
 const alive=b.alive;room.input('driver',{...command(room,1),tick:room.tick-6});room.step();assert.equal(b.alive,alive,'late input cannot undo confirmed impact');
});

test('fixed-wall approaches compare immediate scheduling with former eight-tick scheduling',()=>{
 const results=[];
 for(const speed of [1,C.turboSpeedMultiplier])for(const transitTicks of [0,2,6])for(const oldSchedule of [false,true]){
  const {room,me,b}=nearWall(speed),pressedTick=room.tick,pressedX=b.x;
  for(let i=0;i<transitTicks;i++)room.step();
  const accepted=room.input('driver',{...command(room,speed),tick:pressedTick});
  if(oldSchedule&&me.inputs.length)me.inputs[0].at=Math.max(room.tick+1,pressedTick+8);
  let turnX=null,turnTick=null;
  for(let i=0;i<14;i++){room.step();if(b.dir===2&&turnTick===null){turnTick=room.tick;turnX=b.x;}}
  if(transitTicks===0){assert.equal(b.alive,!oldSchedule,'extra lead alone loses the near-wall turn');}
  if(!oldSchedule&&transitTicks===2)assert(b.alive,'two-tick network delivery still clears wall');
  results.push({speed:38.4*speed,transitMs:transitTicks/MP.tickHz*1000,oldSchedule,accepted,survived:b.alive,turnDelayMs:turnTick===null?null:(turnTick-pressedTick)/MP.tickHz*1000,turnOffsetMeters:turnX===null?null:(turnX-pressedX)*C.cellMeters});
 }
 console.log(JSON.stringify({fixedWallApproaches:results}));
});

test('local keypress turns at its fractional position immediately, with a joined trail and no lead',t=>{
 for(const rtt of [0,80,500])for(const speed of [1,C.turboSpeedMultiplier]){
  const {room}=nearWall(speed,12),state=room.state(),me=state.clients[0],source=state.race.cycles[me.seat];
  source.segment=0;state.race.trails=[{bikeId:source.id,team:source.team,dir:1,x1:source.x-2,z1:0,x2:source.x,z2:0}];
  let now=1000;t.mock.method(performance,'now',()=>now);
  const messages=[],client=Object.create(MultiplayerClient.prototype);
  Object.assign(client,{state,me,received:1000,rtt,pending:[],seq:0,lastSent:0,control:{turbo:speed>1,brake:false},socket:{readyState:1,send:raw=>messages.push(JSON.parse(raw))}});
  const run={cycleRace:{round:-1,site:{x:0,s:0}}};
  now=1003.25;client.apply(run);const before={...run.cycleRace.cycles[me.seat]};
  client.input({cycleTurn:1,cycleTurbo:speed>1});client.apply(run);
  const turned=run.cycleRace.cycles[me.seat];assert.equal(turned.dir,2,'direction changes in the same frame');
  assert.equal(turned.x,before.x);assert.equal(turned.z,before.z,'keypress does not teleport the turn');
  assert.equal(messages[0].tick,Math.floor(state.tick+(.00325+rtt/2000)*MP.tickHz));
  assert(!('predictionTick' in messages[0]),'fractional render time is not sent as authority');
  const trails=run.cycleRace.trails.filter(t=>t.bikeId===me.seat);assert.equal(trails.length,2);
  assert.equal(trails[0].x2,trails[1].x1);assert.equal(trails[0].z2,trails[1].z1);
  now+=2;client.apply(run);assert.equal(turned.x,before.x);assert(turned.z>before.z);
  assert.equal(turned.turns,source.turns+1,'replaying frames does not duplicate input');
  t.mock.restoreAll();
 }
});
