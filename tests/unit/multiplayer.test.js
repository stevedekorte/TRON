import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom,wireState} from '../../shared/multiplayer/room.js';
import {MP} from '../../shared/multiplayer/config.js';
const join=(room,n)=>{for(let i=0;i<n;i++)assert(room.join('u'+i));};
function racing(room){room.race.remaining=0;room.step();}
function kill(room,c){const b=room.race.cycles[c.seat];b.alive=false;room.race.crashes.push({id:b.id,x:b.x,z:b.z,team:b.team,dir:b.dir,time:room.race.time});room.step();}
test('12 seats, excess spectators, random balanced teams and AI vacancies',()=>{
 const r=new CycleRoom();join(r,14);assert.equal(r.race.cycles.length,12);assert.equal(r.queue.length,2);
 assert.equal(r.race.cycles.filter(b=>b.human).length,12);
 const small=new CycleRoom();join(small,2);assert.equal(small.race.cycles.filter(b=>!b.human).length,small.race.teamCount*3-2);
 for(let i=0;i<12;i++){const prev=r.race.teamCount;r.nextRound();assert.equal(r.race.teamCount,4);for(let team=0;team<r.race.teamCount;team++)assert.equal(r.race.cycles.filter(b=>b.team===team).length,3);}
});
test('individual survivors retain seats, dead winner queues behind existing spectators',()=>{
 const r=new CycleRoom();join(r,14);racing(r);const dead=r.clients.get('u0'),survivor=r.clients.get('u1');kill(r,dead);
 assert.deepEqual(r.queue,['u12','u13','u0']);r.nextRound();
 assert.notEqual(survivor.seat,null);assert.notEqual(r.clients.get('u12').seat,null);assert.equal(dead.seat,null);assert.deepEqual(r.queue,['u13','u0']);
});
test('disconnect releases a seat, new arrivals do not replace active AI mid-match',()=>{
 const r=new CycleRoom();join(r,2);racing(r);r.join('later');assert.equal(r.clients.get('later').seat,null);
 r.leave('u0');r.nextRound();assert.notEqual(r.clients.get('later').seat,null);assert(!r.clients.has('u0'));
});
test('authority rejects spoofed timing, duplicate inputs and stale round, applies multiple humans',()=>{
 const r=new CycleRoom();join(r,2);racing(r);
 const command={type:'input',seq:1,round:r.race.round,tick:r.tick+MP.inputLeadTicks,turn:1,turbo:false,brake:false};
 const a=r.clients.get('u0'),b=r.clients.get('u1'),before=[r.race.cycles[a.seat].dir,r.race.cycles[b.seat].dir];
 assert(!r.input('unknown',command));assert(!r.input('u0',{...command,tick:r.tick+1000}));assert(!r.input('u0',{...command,round:0}));assert(!r.input('u0',{...command,turn:Infinity}));
 assert(r.input('u0',command));assert(!r.input('u0',command));assert(r.input('u1',{...command,turn:-1}));
 r.step();
 assert.equal(r.race.cycles[a.seat].dir,(before[0]+1)%4);assert.equal(r.race.cycles[b.seat].dir,(before[1]+3)%4);
 assert.equal(a.ack,1);assert.equal(b.ack,1);
});
test('snapshot excludes occupancy and delta reconstructs trails including truncation',()=>{
 const r=new CycleRoom();join(r,2);racing(r);const a=r.state();assert(!('occupied' in a.race));
 for(let i=0;i<20;i++)r.step();const b=r.state(),wire=wireState(b,a),trails=a.race.trails.slice(0,wire.trailLength);
 for(const [i,t] of wire.trailChanges)trails[i]=t;assert.deepEqual(trails,b.race.trails);assert(!wire.full);
 r.nextRound();assert(wireState(r.state(),b).full);
});
test('stuck controls time out and empty arena does no simulation work',()=>{
 const r=new CycleRoom();assert.equal(r.tick,0);r.step();assert.equal(r.tick,0);join(r,1);racing(r);
 const c=r.clients.get('u0');c.control={turbo:true,brake:true};for(let i=0;i<MP.inputTimeoutTicks+1;i++)r.step();assert.deepEqual(c.control,{turbo:false,brake:false});
 r.leave('u0');const tick=r.tick;r.step();assert.equal(r.tick,tick);
});

test('team size stays at three as the countdown population grows',()=>{
 const r=new CycleRoom();r.race.teamCount=4;r.nextRound();
 const remaining=r.race.remaining;
 for(let i=0;i<14;i++){
  r.join('g'+i);
  assert.equal(r.race.cyclesPerTeam,3);
  for(let team=0;team<r.race.teamCount;team++)assert.equal(r.race.cycles.filter(b=>b.team===team).length,3);
  assert(r.race.cycles.length>=Math.min(i+1,12));
  assert.equal(r.race.remaining,remaining,'joins do not postpone launch');
 }
 assert.equal(r.race.teamCount,4);assert.equal(r.queue.length,2);
});

test('only the sole connected human can restart the authoritative match',()=>{
 const room=new CycleRoom();room.join('solo');room.race.remaining=0;room.step();
 const round=room.race.round;
 assert.equal(room.restart('unknown',round),false);
 assert.equal(room.restart('solo',round-1),false);
 assert.equal(room.restart('solo',round),true);
 assert.equal(room.race.round,round+1);assert.equal(room.race.phase,'racing');
 assert.equal(room.race.remaining,0);assert(room.race.trails.length>0,'immediate start initializes trails');
 assert.equal(room.restart('solo',round),false,'duplicate request cannot restart again');
 room.race.remaining=0;room.step();room.join('spectator');
 assert.equal(room.clients.get('spectator').seat,null);
 assert.equal(room.restart('solo',room.race.round),false,'spectators count as other humans');
 room.leave('spectator');
 const bike=room.race.cycles[room.clients.get('solo').seat];bike.alive=false;
 assert.equal(room.restart('solo',room.race.round),true,'eliminated sole player can restart');
 assert(room.race.cycles[room.clients.get('solo').seat].alive);
});

test('compact deltas reconstruct turns, deaths, rewards, joins and trail truncation',async()=>{
 const {projectState,compactSnapshot,decodeSnapshot}=await import('../../shared/multiplayer/snapshots.js');
 const room=new CycleRoom();join(room,12);racing(room);
 let previous=null,decoded=null,legacyBytes=0,compactBytes=0;
 for(let i=0;i<600;i++){
  if(i===30){room.race.cycles[1].reserveReward={revision:1,turboFrom:.2,brakeFrom:.4,target:1};}
  if(i===60)kill(room,room.clients.get('u0'));
  if(i===90){room.join('late');room.leave('u2');}
  if(i===120)room.race.trails.splice(0,1);
  room.step();if(room.tick%6)continue;
  const raw=room.state(),state=projectState(raw),wire=compactSnapshot(state,previous);
  decoded=decodeSnapshot(JSON.parse(JSON.stringify(wire)),decoded);
  assert.deepEqual(decoded.race,state.race);assert.deepEqual(decoded.clients,state.clients);
  assert(!JSON.stringify(wire).includes('reactionTiming'));assert(!JSON.stringify(wire).includes('renderPrevious'));
  assert(!JSON.stringify(wire).includes('occupied'));
  legacyBytes+=Buffer.byteLength(JSON.stringify(wireState(raw,room.lastRaw)));compactBytes+=Buffer.byteLength(JSON.stringify(wire));
  previous=state;room.lastRaw=raw;
 }
 assert(compactBytes<legacyBytes*.35,`expected >65% reduction; ${compactBytes}/${legacyBytes}`);
 room.nextRound();const state=projectState(room.state()),full=compactSnapshot(state,previous);
 assert(full.full);assert.deepEqual(decodeSnapshot(full,decoded).race,state.race);
});

test('compact stream validates its baseline and preserves optional-field removal',async()=>{
 const {projectState,compactSnapshot,decodeSnapshot}=await import('../../shared/multiplayer/snapshots.js');
 const room=new CycleRoom();join(room,1);racing(room);
 const b=room.race.cycles.find(b=>!b.human);b.reserveReward={revision:1,turboFrom:0,brakeFrom:0,target:1};
 const a=projectState(room.state());delete b.reserveReward;room.step();const next=projectState(room.state()),delta=compactSnapshot(next,a);
 assert.equal(decodeSnapshot(delta,null),null);
 assert.equal(decodeSnapshot(delta,{...a,tick:a.tick+1}),null);
 assert.equal(decodeSnapshot(delta,{...a,race:{...a.race,round:a.race.round+1}}),null);
 assert(!('reserveReward' in decodeSnapshot(delta,a).race.cycles[b.id]));
 const client=decodeSnapshot(compactSnapshot(a,null),null);assert(client.full);
});

test('applied turns and reserve input changes request an immediate authoritative snapshot',()=>{
 const room=new CycleRoom();join(room,1);racing(room);
 const tick=room.tick;room.input('u0',{round:room.race.round,seq:1,tick:tick+1,turn:1,turbo:false,brake:false});
 room.step();assert(room.urgentSnapshot);assert.notEqual(room.tick%MP.snapshotTicks,0);
});

test('compact and legacy peers share the arena; late-join baselines remain independent',async()=>{
 const {ArenaHub}=await import('../../shared/multiplayer/hub.js');
 const {decodeSnapshot}=await import('../../shared/multiplayer/snapshots.js');
 function socket(){return {messages:[],listeners:{},send(raw){this.messages.push(JSON.parse(raw));},addEventListener(type,fn){this.listeners[type]=fn;},close(){if(!this.closed){this.closed=true;this.listeners.close?.();}}};}
 const hub=new ArenaHub(),a=socket(),b=socket(),legacy=socket();
 try{
  hub.add(a,MP.protocol);hub.add(b,MP.protocol);hub.add(legacy,MP.legacyProtocol);
  hub.last=performance.now()-70;hub.pump();
  for(const peer of [a,b]){
   let state=null;for(const message of peer.messages)if(message.type==='state'){state=decodeSnapshot(message,state);assert(state);}
   assert.equal(state.clients.length,3);assert.equal(state.protocol,MP.protocol);
  }
  assert.equal(legacy.messages[0].protocol,MP.legacyProtocol);
  assert.equal(legacy.messages.at(-1).protocol,MP.legacyProtocol);
  assert.equal(legacy.messages.at(-1).clients.length,3);
  assert(Array.isArray(legacy.messages.at(-1).race.cycles));
  a.listeners.message({data:JSON.stringify({type:'resync'})});
  assert.equal(a.messages.at(-1).full,true);assert(decodeSnapshot(a.messages.at(-1),null));
 }finally{hub.dispose();}
});


test('MP presentation moves between ticks without applying a future turn early',async t=>{
 const {MultiplayerClient}=await import('../../src/multiplayer/client.js');
 const {LIGHT_CYCLES:C}=await import('../../shared/simulation/config/light-cycles.js');
 const room=new CycleRoom();join(room,1);racing(room);
 const state=room.state(),me=state.clients[0],source=state.race.cycles[me.seat];
 source.speedMultiplier=1;source.reserveTurboRequested=false;source.reserveBrakeRequested=false;
 let now=1000;t.mock.method(performance,'now',()=>now);
 const client=Object.create(MultiplayerClient.prototype);
 Object.assign(client,{state,me,received:now,rtt:0,pending:[]});
 const run={cycleRace:{round:-1,site:{x:0,s:0}}};
 const pose=()=>{client.apply(run);return {...run.cycleRace.cycles[me.seat]};};
 const sourceBefore=structuredClone(source),initial=pose();
 for(let frame=1;frame<=8;frame++){
  now=1000+frame*2;const b=pose();
  const distance=Math.hypot(b.x-initial.x,b.z-initial.z)*C.cellMeters;
  assert(Math.abs(distance-C.speedMetersPerSecond*frame*.002)<1e-9,'every 2 ms frame advances smoothly');
  const tail=run.cycleRace.trails[b.segment];assert.equal(tail.x2,b.x);assert.equal(tail.z2,b.z);
 }
 client.pending=[{seq:1,tick:state.tick+MP.inputLeadTicks+3,turn:1,turbo:false,brake:false}];
 now=1000+3000/MP.tickHz-.01;assert.equal(pose().dir,source.dir,'fractional prediction must not apply turn early');
 now=1000+3000/MP.tickHz+.01;const turned=pose();assert.equal(turned.dir,(source.dir+1)%4);
 assert.deepEqual(source,sourceBefore,'presentation does not mutate authority');
 now=5000;const stopped=pose();assert.equal(stopped.x,source.x);assert.equal(stopped.z,source.z,'stale state is not extrapolated');
});
