import test from 'node:test';
import assert from 'node:assert/strict';
import {CycleRoom,wireState} from '../shared/multiplayer/room.js';
import {MP} from '../shared/multiplayer/config.js';
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
 for(let i=0;i<MP.inputLeadTicks;i++)r.step();
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
