import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiplayerClient} from '../../src/multiplayer/client.js';
import {CycleRoom} from '../../shared/multiplayer/room.js';
import {projectState,compactSnapshot} from '../../shared/multiplayer/snapshots.js';
import {MP} from '../../shared/multiplayer/config.js';
function fixture(t,actions){
 const sockets=[];
 class Socket{
  constructor(){this.readyState=0;sockets.push(this);queueMicrotask(()=>actions[sockets.length-1]?.(this));}
  send(){}
  close(){this.readyState=3;this.onclose?.({code:1000});}
 }
 const original=globalThis.WebSocket;globalThis.WebSocket=Socket;t.after(()=>{globalThis.WebSocket=original;});
 const c=new MultiplayerClient({url:'https://example.test'});t.after(()=>c.close());return {c,sockets};
}
function welcome(s){
 s.readyState=1;s.onopen?.();s.onmessage({data:JSON.stringify({type:'welcome',protocol:MP.protocol,id:'u0'})});
 const r=new CycleRoom();r.join('u0');s.onmessage({data:JSON.stringify(compactSnapshot(projectState(r.state()),null))});
}
const limits={attempts:3,timeoutMs:30,retryDelayMs:1};
test('initial connection retries an error, disposes old socket, and accepts a valid state',async t=>{
 const {c,sockets}=fixture(t,[s=>s.onerror(),welcome]);await c.connect(limits);
 assert.equal(sockets.length,2);assert.equal(sockets[0].readyState,3);assert.equal(sockets[0].onmessage,null);assert(c.state);assert(!c.disconnected);
});
test('connection failures have a finite retry limit',async t=>{
 const {c,sockets}=fixture(t,Array(3).fill(s=>s.onerror()));await assert.rejects(c.connect(limits),/UNAVAILABLE/);assert.equal(sockets.length,3);assert(sockets.every(s=>s.readyState===3));
});
test('timeout retries and late abandoned messages cannot become current state',async t=>{
 const {c,sockets}=fixture(t,[()=>{},welcome]);await c.connect(limits);assert.equal(sockets.length,2);assert.equal(sockets[0].onmessage,null);assert(c.state);
});
test('protocol mismatch asks for reload without retrying',async t=>{
 const {c,sockets}=fixture(t,[s=>s.onmessage({data:JSON.stringify({type:'welcome',protocol:-1})})]);await assert.rejects(c.connect(limits),/VERSION MISMATCH/);assert.equal(sockets.length,1);
});
test('explicit close cancels a pending connection without retrying',async t=>{
 const {c,sockets}=fixture(t,[()=>{}]);const pending=c.connect(limits);c.close();await assert.rejects(pending,/CANCELLED/);assert.equal(sockets.length,1);
});
