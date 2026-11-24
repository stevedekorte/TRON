// Arena presence: player counts for menus and solo games, the arrival line, and
// the Worker status route.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaHub} from '../../shared/multiplayer/hub.js';
import {MP,MP_PRESENCE} from '../../shared/multiplayer/config.js';
import {ArenaPresence,arenaPlayersLabel} from '../../src/multiplayer/arena-presence.js';
import {ArenaArrivalVoice,ARENA_ARRIVAL_VOICE} from '../../src/audio/arena-arrival-voice.js';
import {createWorker} from '../../workers/jev/index.js';
const socket=()=>({messages:[],listeners:{},send(raw){this.messages.push(JSON.parse(raw));},addEventListener(type,fn){this.listeners[type]=fn;},close(){if(!this.closed){this.closed=true;this.listeners.close?.();}}});

test('the hub reports connected humans and each change in their number',()=>{
 const counts=[],hub=new ArenaHub({onPlayers:n=>counts.push(n)}),a=socket(),b=socket();
 try{
  assert.deepEqual(hub.status(),{players:0,round:0,phase:'empty'});
  hub.add(a,MP.protocol);hub.add(b,MP.protocol);
  assert.equal(hub.playerCount(),2);assert.equal(hub.status().players,2);
  a.close();a.listeners.close();          // a repeated close is reported once
  assert.equal(hub.playerCount(),1);
  b.close();assert.equal(hub.playerCount(),0);
  assert.deepEqual(counts,[1,2,1,0]);
 }finally{hub.dispose();}
});

test('a rider whose connection drops mid-round no longer counts as present',()=>{
 const hub=new ArenaHub(),a=socket(),b=socket();
 try{
  hub.add(a,MP.protocol);hub.add(b,MP.protocol);
  hub.room.race.phase='racing';for(const c of hub.room.race.cycles)c.alive=true;
  a.close();
  assert.equal(hub.room.clients.size,2,'the cycle rides on unattended');
  assert.equal(hub.playerCount(),1);
 }finally{hub.dispose();}
});

test('the menu label names the arena population',()=>{
 assert.equal(arenaPlayersLabel(null),'');
 assert.equal(arenaPlayersLabel(0),'(NO PLAYERS)');
 assert.equal(arenaPlayersLabel(1),'(1 PLAYER)');
 assert.equal(arenaPlayersLabel(3),'(3 PLAYERS)');
});

test('presence follows the watcher socket and polls the status route when it closes',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const sockets=[];class FakeSocket{constructor(url){this.url=String(url);this.sent=[];sockets.push(this);}send(m){this.sent.push(m);}close(){}}
 const fetches=[];const fetchImpl=async url=>{fetches.push(String(url));return {ok:true,json:async()=>({players:4})};};
 const changes=[],presence=new ArenaPresence({base:'https://arena.example',WebSocketImpl:FakeSocket,fetchImpl,onChange:(n,p)=>changes.push([p,n])});
 presence.start();
 assert.equal(sockets[0].url,'wss://arena.example'+MP_PRESENCE.watchPath);
 sockets[0].onopen();
 for(const players of [0,0,2,1])sockets[0].onmessage({data:JSON.stringify({type:'arena',players})});
 sockets[0].onmessage({data:'pong'});
 t.mock.timers.tick(MP_PRESENCE.pingSeconds*1000);assert.deepEqual(sockets[0].sent,['ping']);
 sockets[0].onclose();await new Promise(r=>setImmediate(r));
 assert.deepEqual(fetches,['https://arena.example'+MP_PRESENCE.statusPath]);
 t.mock.timers.tick(MP_PRESENCE.reconnectSeconds[0]*1000);assert.equal(sockets.length,2,'reconnects after the first backoff');
 presence.stop();
 assert.deepEqual(changes,[[null,0],[0,2],[2,1],[1,4],[4,null]]);
});

test('the arrival line waits briefly for another announcement, plays once, and lapses',()=>{
 let now=0;const started=[];
 const context={get currentTime(){return now;},createBufferSource:()=>({connect(){},disconnect(){},start(){started.push(now);},stop(){}}),createGain:()=>({gain:{value:0},connect(){},disconnect(){}})};
 const voice=new ArenaArrivalVoice(context,{},{[ARENA_ARRIVAL_VOICE.sample]:{}});
 assert.equal(voice.update(true),false,'nothing requested');
 voice.request();now=1;assert.equal(voice.update(true,true),false,'blocked by another line');
 now=2;assert.equal(voice.update(true),true);assert.equal(voice.update(true),false,'once per request');
 voice.request();now=2+ARENA_ARRIVAL_VOICE.waitSeconds+.1;assert.equal(voice.update(true,true),false);
 assert.equal(voice.update(true),false,'lapsed');
 voice.request();assert.equal(voice.update(false),false);assert.equal(voice.update(true),false,'muted requests are dropped');
 assert.deepEqual(started,[2]);
});

test('the Worker answers arena status with a short cache and refuses other methods',async()=>{
 const seen=[];
 const env={ALLOWED_ORIGINS:'https://dekorte.com',MULTIPLAYER_ENABLED:'true',MULTIPLAYER_ARENA:{idFromName:n=>n,get:()=>({fetch:async request=>{seen.push(new URL(request.url).pathname);return Response.json({players:3,round:7,phase:'racing',extra:1});}})}};
 const worker=createWorker(),request=(method='GET')=>new Request('https://w.example'+MP_PRESENCE.statusPath,{method,headers:{Origin:'https://dekorte.com'}});
 const response=await worker.fetch(request(),env,{waitUntil(){}});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{players:3,phase:'racing',round:7});
 assert.match(response.headers.get('Cache-Control'),/max-age=5/);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://dekorte.com');
 assert.equal((await worker.fetch(request('POST'),env,{waitUntil(){}})).status,405);
 assert.equal((await worker.fetch(new Request('https://w.example'+MP_PRESENCE.statusPath,{headers:{Origin:'https://evil.example'}}),env,{waitUntil(){}})).status,403);
 assert.deepEqual(seen,[MP_PRESENCE.statusPath]);
});
