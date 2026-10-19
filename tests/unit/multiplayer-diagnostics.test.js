import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerDiagnostics} from '../../src/multiplayer/diagnostics.js';
import {ArenaHub} from '../../shared/multiplayer/hub.js';
import {decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
import {MP} from '../../shared/multiplayer/config.js';
test('delivery diagnostics distinguish host send spacing from later delivery delay without clock synchronization',()=>{
 const d=new MultiplayerDiagnostics();
 d.snapshot({sentAt:100000},200);
 d.snapshot({sentAt:100050},270);
 d.pong({sent:260,timing:{latePumps:2}},280);
 const report=d.report();assert.equal(report.deliveryVariationMs.p50,20);assert.equal(report.rttMs.p50,20);assert.equal(report.server.latePumps,2);
 for(let i=0;i<300;i++)d.pong({sent:i},i+1);
 assert.equal(d.report().rttMs.samples,256);
});
test('catch-up sends one current decodable snapshot and reports scheduler stalls',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 const socket={messages:[],listeners:{},send(raw){this.messages.push(JSON.parse(raw));},addEventListener(type,fn){this.listeners[type]=fn;},close(){}};
 const hub=new ArenaHub();
 try{
  hub.add(socket);let previous=socket.messages.find(m=>m.type==='state');const before=socket.messages.length;
  now=180;hub.pump();
  assert.equal(socket.messages.length,before+1,'no queue of obsolete catch-up snapshots');
  const packet=socket.messages.at(-1),decoded=decodeSnapshot(packet,previous);
  assert.equal(decoded.tick,hub.room.tick);assert(decoded.tick>=20);assert(Number.isFinite(packet.sentAt));
  socket.listeners.message({data:JSON.stringify({type:'ping',sent:1})});
  const pong=socket.messages.at(-1);assert.equal(pong.timing.latePumps,1);assert.equal(pong.timing.maxPumpGapMs,180);
  now=500;hub.pump();assert.equal(hub.timing.discardedMs,120);assert(hub.timing.maxCatchupSteps<=MP.maxCatchupSteps);
 }finally{hub.dispose();}
});
