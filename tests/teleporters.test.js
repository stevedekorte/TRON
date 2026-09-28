import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRun as createBaseRun,step} from '../src/simulation/run.js';
import {TELEPORT_PADS,TELEPORTERS,fullyInsidePad,updateTeleporters,vehicleTeleportPad,TELEPORT_VEHICLE_BOUNDS} from '../src/simulation/teleporters.js';
import {MAZE_INSTANCES,freePosition,WALL_HEIGHT} from '../src/levels/maze.js';
const createRun=(seed)=>{const r=createBaseRun(seed);r.teleportPads=structuredClone(TELEPORT_PADS);return r;};
const empty=()=>{const r=createRun(1982);r.recognizers=[];r.enemyTanks=[];r.dataBeams=[];return r;};
const place=(e,p)=>Object.assign(e,{x:p.x,s:p.s,yaw:0,speed:0,turretYaw:0});
test('four grid-aligned clear exterior pads per maze have finite four-wall-high volumes',()=>{
 assert.equal(TELEPORT_PADS.length,4*MAZE_INSTANCES.length);
 for(const p of TELEPORT_PADS){assert.equal(p.size,48);assert.equal(p.height,4*WALL_HEIGHT);for(const edge of [p.x-24,p.x+24,p.s-24,p.s+24])assert.equal(Math.abs(edge%24),0);assert.ok(freePosition(p.x,p.s,p.size/Math.SQRT2));assert.notEqual(TELEPORT_PADS.find(d=>d.id===p.destination).mazeId,p.mazeId);}
});
test('partial hull or rotated turret entry affects rendering but cannot transfer',()=>{
 const r=empty(),p=r.teleportPads[0];place(r,p);r.s=p.s-24;
 assert.equal(vehicleTeleportPad(r,r.teleportPads),p);assert.equal(fullyInsidePad(r,p),false);updateTeleporters(r);assert.equal(r.teleportRevision,0);
 place(r,p);r.turretYaw=Math.PI/2;r.x=p.x+20;assert.equal(fullyInsidePad(r,p),false);
});
test('whole entry transfers instantly, preserves local offset and every movement/control value',()=>{
 const r=empty(),p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination);place(r,p);
 Object.assign(r,{x:p.x+3,s:p.s-4,speed:30,yaw:.2,turretYaw:.1,steer:.4,cruiseThrottle:true,turboRemaining:2,gunner:true});
 updateTeleporters(r);assert.equal(r.x,dest.x+3);assert.equal(r.s,dest.s-4);assert.equal(r.speed,30);assert.equal(r.yaw,.2);assert.equal(r.turretYaw,.1);assert.equal(r.steer,.4);assert.equal(r.cruiseThrottle,true);assert.equal(r.turboRemaining,2);assert.equal(r.gunner,true);assert.equal(r.teleport,null);
 assert.equal(r.teleportRevision,1);assert.equal(r.teleportArrival,dest.id);updateTeleporters(r);assert.equal(r.teleportRevision,1);
 // Partial exit still locks the destination, even if the vehicle reverses in.
 r.x=dest.x+24;updateTeleporters(r);assert.equal(r.teleportArrival,dest.id);place(r,dest);updateTeleporters(r);assert.equal(r.teleportRevision,1);
 r.x=dest.x+70;updateTeleporters(r);assert.equal(r.teleportArrival,null);place(r,dest);updateTeleporters(r);assert.equal(r.teleportRevision,2);
});
test('aircraft ceiling crossing clips before complete entry and vertical exit rearms the pad',()=>{
 const r=createRun(1982),e=r.recognizers[0],p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination);r.recognizers=[e];r.enemyTanks=[];place(e,p);
 Object.assign(e,{y:TELEPORTERS.height+2,vx:12,vs:23,vy:-5,yawVelocity:.3});
 assert.equal(vehicleTeleportPad(e,r.teleportPads,true),p);assert.equal(fullyInsidePad(e,p,true),false);updateTeleporters(r);assert.ok(!e.teleportRevision);
 e.y=TELEPORTERS.height-TELEPORT_VEHICLE_BOUNDS.airTop;updateTeleporters(r);assert.equal(e.teleportArrival,dest.id);
 assert.equal(e.vx,12);assert.equal(e.vs,23);assert.equal(e.vy,-5);assert.equal(e.yawVelocity,.3);
 e.y=TELEPORTERS.height+TELEPORT_VEHICLE_BOUNDS.airBottom+1;updateTeleporters(r);assert.equal(e.teleportArrival,null);assert.equal(vehicleTeleportPad(e,r.teleportPads,true),null);
});
test('occupied destinations delay transfer without freezing the entering vehicle',()=>{
 const r=createRun(1982),p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination),other=r.enemyTanks[0];r.enemyTanks=[other];r.recognizers=[];
 place(r,p);place(other,dest);other.teleportArrival=dest.id;r.speed=12;updateTeleporters(r);assert.equal(r.x,p.x);assert.equal(r.speed,12);
 other.x+=100;updateTeleporters(r);assert.equal(r.x,dest.x);
});
test('simultaneous requests for a destination transfer only one vehicle',()=>{
 const r=createRun(1982),e=r.enemyTanks[0],p=r.teleportPads[0],q=r.teleportPads[1];q.destination=p.destination;r.enemyTanks=[e];r.recognizers=[];place(r,p);place(e,q);
 updateTeleporters(r);assert.equal(r.teleportRevision,1);assert.ok(!e.teleportRevision);assert.equal(e.x,q.x);
});
test('driven high-speed entry retains motion and exits without bouncing back',()=>{
 const r=empty(),p=r.teleportPads[0];place(r,p);r.s-=40;r.speed=30;
 for(let i=0;i<300;i++)step(r,{throttle:1},1/60);
 assert.equal(r.teleportRevision,1);assert.ok(r.speed>20);assert.equal(r.teleportArrival,null);
});
test('arrival shares only destination allies recorded knowledge immediately',()=>{
 const r=createRun(1982),e=r.enemyTanks[0],peer=r.recognizers[0],p=r.teleportPads[0],dest=r.teleportPads.find(d=>d.id===p.destination);
 r.enemyTanks=[e];r.recognizers=[peer];place(e,p);Object.assign(peer,{x:dest.x+80,s:dest.s,y:90,memory:{x:dest.x+100,s:dest.s+100,vx:0,vs:22,seenAt:r.time,source:peer.id},canSee:true,state:'pursue'});
 updateTeleporters(r);assert.deepEqual(e.memory,peer.memory);assert.notEqual(e.memory,peer.memory);assert.equal(e.canSee,false);assert.equal(e.mazeId,dest.mazeId);
});
test('teleport audio events occur only for completed transfers, once per departure/arrival',()=>{
 const r=empty(),p=r.teleportPads[0];place(r,p);r.s-=24;updateTeleporters(r);assert.equal(r.events.filter(e=>e.type==='teleport').length,0);
 place(r,p);updateTeleporters(r);const events=r.events.filter(e=>e.type==='teleport');assert.deepEqual(events.map(e=>e.phase),['departure','arrival']);assert.ok(events.every(e=>e.player));assert.equal(events[0].x,p.x);
 updateTeleporters(r);assert.equal(r.events.filter(e=>e.type==='teleport').length,2);
});

test('normal games contain no active teleporter pads',()=>{
 const r=createBaseRun(1982);assert.deepEqual(r.teleportPads,[]);
 place(r,TELEPORT_PADS[0]);updateTeleporters(r);assert.equal(r.teleportRevision,0);
});

test('disabled pads do not modify the floor shader',async()=>{
 const {createTeleporters}=await import('../src/rendering/teleporters.js');
 const material={onBeforeCompile:()=>{},customProgramCacheKey:()=> 'floor'};
 const original={...material};const renderer=createTeleporters(material,[]);
 renderer.update([],0);assert.deepEqual(material,original);
});
