import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,boostTank} from '../src/simulation/run.js';
import {TELEPORT_PADS,fullyInsidePad,updateTeleporters,teleportEffectAge} from '../src/simulation/teleporters.js';
import {materializationDuration} from '../src/game/materialization.js';
import {MAZE_INSTANCES,freePosition} from '../src/levels/maze.js';
import {canSeeClu} from '../src/simulation/recognizers.js';
import {debrisVehicleTargets} from '../src/simulation/debris-damage.js';
const empty=()=>{const r=createRun(1982);r.recognizers=[];r.enemyTanks=[];r.dataBeams=[];return r;};
const place=(e,p)=>Object.assign(e,{x:p.x,s:p.s,yaw:0,speed:0,turretYaw:0});
const advance=(r,n)=>{for(let i=0;i<Math.ceil(n*60);i++)step(r,{},1/60);};
test('four clear exterior pads per maze link only to other mazes',()=>{
 assert.equal(TELEPORT_PADS.length,4*MAZE_INSTANCES.length);
 for(const p of TELEPORT_PADS){assert.equal(p.size,48);for(const edge of [p.x-24,p.x+24,p.s-24,p.s+24])assert.equal(Math.abs(edge%24),0);assert.ok(freePosition(p.x,p.s,p.size/Math.SQRT2));const dest=TELEPORT_PADS.find(d=>d.id===p.destination);assert.ok(dest);assert.notEqual(dest.mazeId,p.mazeId);}
});
test('entry requires the complete hull and rotated turret, at any altitude',()=>{
 const r=empty(),p=r.teleportPads[0];place(r,p);assert.ok(fullyInsidePad(r,p));
 r.s=p.s+p.size/2-1;assert.equal(fullyInsidePad(r,p),false);
 place(r,p);r.turretYaw=Math.PI/2;r.x=p.x+p.size/2-4;assert.equal(fullyInsidePad(r,p),false);
 const e={x:p.x,s:p.s,y:400,yaw:Math.PI/4};assert.ok(fullyInsidePad(e,p,true));e.x+=p.size/2-1;assert.equal(fullyInsidePad(e,p,true),false);
});
test('Clu dematerializes, relocates, materializes and must leave before reentry',()=>{
 const r=empty(),p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination);place(r,p);updateTeleporters(r);
 assert.equal(r.teleport.phase,'out');assert.equal(teleportEffectAge(r,r.time),materializationDuration());
 assert.equal(boostTank(r),false);const shots=r.shots;step(r,{throttle:1,steer:1,fire:true},1/60);assert.equal(r.x,p.x);assert.equal(r.s,p.s);assert.equal(r.shots,shots);
 assert.equal(canSeeClu({x:r.x,s:r.s,y:80},r),false);assert.ok(!debrisVehicleTargets(r).some(t=>t.key==='clu'));
 advance(r,2.75);assert.equal(r.teleport.phase,'in');assert.equal(r.x,dest.x);assert.equal(r.s,dest.s);
 advance(r,2.8);assert.equal(r.teleport,null);advance(r,6);assert.equal(r.teleport,null);
 r.x=dest.x+70;updateTeleporters(r);assert.equal(r.teleportArrival,null);place(r,dest);updateTeleporters(r);assert.equal(r.teleport.phase,'out');
});
test('ground tanks and airborne Recognizers transfer without changing altitude or heading',()=>{
 for(const air of [false,true]){
  const r=createRun(1982),e=air?r.recognizers[0]:r.enemyTanks[0],p=r.teleportPads[0];r.recognizers=air?[e]:[];r.enemyTanks=air?[]:[e];
  place(e,p);e.yaw=.3;e.y=air?180:3.8;const y=e.y;updateTeleporters(r);assert.equal(e.teleport.phase,'out');
  r.time=materializationDuration();updateTeleporters(r);assert.equal(e.y,y);assert.equal(e.yaw,.3);assert.equal(e.teleport.phase,'in');assert.equal(e.mazeId,1);
  r.time+=materializationDuration();updateTeleporters(r);assert.equal(e.teleport,null);assert.equal(e.speed,0);assert.equal(e.vx,0);
 }
});
test('occupied destinations defer departure and new arrivals defer relocation',()=>{
 const r=createRun(1982),p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination),other=r.enemyTanks[0];
 r.enemyTanks=[other];r.recognizers=[];place(r,p);place(other,dest);updateTeleporters(r);assert.equal(r.teleport,null);
 other.x+=100;updateTeleporters(r);assert.equal(r.teleport.phase,'out');place(other,dest);r.time=3;updateTeleporters(r);assert.equal(r.x,p.x);
 other.x+=100;updateTeleporters(r);assert.equal(r.x,dest.x);assert.equal(r.teleport.phase,'in');
});
test('fresh run clears transit and arrival locks',()=>{
 const r=createRun(1982);assert.equal(r.teleport,null);assert.equal(r.teleportArrival,null);assert.ok(r.recognizers.every(e=>!e.teleport));
});
test('moving Recognizers trigger on full entry at pursuit speed, but edge overflights do not',()=>{
 for(const [yaw,offset,altitude,expected] of [[0,0,80,true],[0,4,80,true],[0,6,80,true],[0,12,80,true],[0,14,80,false],[Math.PI/4,0,400,true],[Math.PI/2,0,80,true]]){
  const r=createRun(1982),e=r.recognizers[0],p=r.teleportPads[0],speed=34.155;
  r.enemyTanks=[];r.recognizers=[e];r.dataBeams=[];
  const dx=-Math.sin(yaw),ds=Math.cos(yaw);
  Object.assign(e,{x:p.x-dx*70+Math.cos(yaw)*offset,s:p.s-ds*70+Math.sin(yaw)*offset,y:altitude,yaw,vx:dx*speed,vs:ds*speed,vy:0,yawVelocity:0,state:'pursue',canSee:true,nextSense:Infinity,stompDisabled:true,
   memory:{x:p.x+dx*500+Math.cos(yaw)*offset,s:p.s+ds*500+Math.sin(yaw)*offset,vx:dx*speed,vs:ds*speed,seenAt:0,source:e.id}});
  for(let i=0;i<300&&!e.teleport;i++)step(r,{},1/60);
  assert.equal(!!e.teleport,expected,JSON.stringify({yaw,offset,altitude}));
  if(expected){assert.equal(e.teleport.source,p.id);assert.ok(fullyInsidePad(e,p,true));}
 }
});
test('enemy teleport completion inherits destination allies, not departure knowledge',()=>{
 const r=createRun(1982),e=r.enemyTanks[0],peer=r.recognizers[0],p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination);
 r.enemyTanks=[e];r.recognizers=[peer];place(e,p);Object.assign(peer,{x:dest.x+80,s:dest.s,y:90,memory:null});updateTeleporters(r);
 r.time=materializationDuration();updateTeleporters(r);assert.equal(e.teleport.phase,'in');
 r.time+=materializationDuration();peer.memory={x:dest.x+100,s:dest.s+100,vx:0,vs:22,seenAt:r.time,source:peer.id};peer.canSee=true;peer.state='pursue';
 updateTeleporters(r);assert.equal(e.teleport,null);assert.deepEqual(e.memory,peer.memory);assert.notEqual(e.memory,peer.memory);assert.equal(e.canSee,false);
});
