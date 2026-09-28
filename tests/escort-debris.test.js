import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../src/levels/scenario.js';
import { GameSession } from '../src/simulation/game-session.js';
import { updateRecognizers } from '../src/simulation/recognizers.js';
import { updateGroundTanks, escortSlot } from '../src/simulation/ground-tanks.js';
import { moveTank, cannonPose, createRun, step, startPursuit } from '../src/simulation/run.js';
import { airEscortSlot } from '../src/game/carrier.js';
import { Autoplay } from '../src/simulation/autoplay.js';
import { applyTacticalChoice } from '../src/simulation/tactical.js';
import { visibleDebris, avoidDebris } from '../src/simulation/debris-avoidance.js';
import { returningToCarrier } from '../src/simulation/carrier-escort.js';
import { DebrisPhysics, debrisPhysicsReady } from '../src/simulation/debris-physics.js';
import * as THREE from 'three';

test('JEV-mode carrier escorts cross the blueprint maze and rejoin the carrier', () => {
  const { world } = createScenario({ layout: 'blueprint', layoutSeed: 1982, runSeed: 1982 });
  const session = new GameSession({ world, settings: { vehicle: { aiMode: 'jev' } } }),
    r = session.run;
  r.x = -15000;
  r.s = -15000;
  r.enemyTanks = r.enemyTanks.filter((e) => e.role === 'escort');
  r.recognizers = r.recognizers.filter((e) => e.role === 'escort');
  for (const e of [...r.enemyTanks, ...r.recognizers]) e.nextSense = Infinity;
  const dt = 1 / 30;
  let detoured = false;
  for (let i = 0; i < 240 / dt; i++) {
    r.time += dt;
    updateRecognizers(r, dt);
    updateGroundTanks(r, dt, moveTank, cannonPose);
    detoured ||= r.enemyTanks.some((e) => e.escortDetour);
    for (const e of r.enemyTanks) assert(world.freePosition(e.x, e.s, 3.5));
  }
  assert(detoured, 'ground escorts choose a perimeter route');
  for (const e of r.enemyTanks) {
    const slot = escortSlot(e.index, r.time, world);
    assert(
      Math.hypot(e.x - slot.x, e.s - slot.s) < 70,
      JSON.stringify({ e: { x: e.x, s: e.s }, slot }),
    );
    assert.equal(e.state, 'escort');
  }
  for (const e of r.recognizers) {
    const slot = airEscortSlot(e.escortIndex, r.time, world);
    assert(Math.hypot(e.x - slot.x, e.s - slot.s) < 90);
    assert.equal(e.state, 'escort');
  }
  session.dispose();
});
test('fresh target memory interrupts escorting; stale memory returns to duty', () => {
  const e = { role: 'escort', memory: { seenAt: 5 } };
  assert.equal(returningToCarrier(e, 10), false);
  assert.equal(returningToCarrier(e, 50), true);
});
function fixture() {
  const r = createRun(1982);
  Object.assign(r, {
    x: -10000,
    s: -10000,
    yaw: 0,
    speed: 22,
    recognizers: [],
    enemyTanks: [],
    dataBeams: [],
  });
  return r;
}
const piece = (r, values = {}) => ({
  id: 1,
  x: r.x,
  s: r.s + 28,
  y: 2,
  vx: 0,
  vs: 0,
  vy: 0,
  radius: 4,
  halfHeight: 2,
  gravity: 9.81,
  sleeping: true,
  ...values,
});
test('autoplay brakes before visible settled wreckage and resumes when it clears', () => {
  const r = fixture(),
    pilot = new Autoplay();
  pilot.setEnabled(true);
  r.debris = [piece(r)];
  for (let i = 0; i < 180; i++) {
    const cmd = avoidDebris(r, { throttle: 1, steer: 0, turbo: true }).command;
    step(r, cmd, 1 / 60);
    assert(Math.hypot(r.x - r.debris[0].x, r.s - r.debris[0].s) > 7.5);
  }
  assert(Math.abs(r.speed) < 0.5);
  r.debris = [];
  assert.equal(avoidDebris(r, { throttle: 1, steer: 0 }).active, false);
});
test('falling and crossing debris trigger avoidance; overhead and receding pieces do not', () => {
  const r = fixture(),
    cmd = { throttle: 1, steer: 0, turbo: false };
  r.debris = [piece(r, { x: r.x + 20, s: r.s + 22, vx: -20, sleeping: false })];
  assert(avoidDebris(r, cmd).active);
  r.debris = [piece(r, { s: r.s + 44, y: 24, vy: -5, sleeping: false })];
  assert(avoidDebris(r, cmd).active);
  r.debris = [piece(r, { y: 180, vy: 0, sleeping: false })];
  assert(!avoidDebris(r, cmd).active);
  r.debris = [piece(r, { s: r.s - 25, vs: -20, sleeping: false })];
  assert(!avoidDebris(r, cmd).active);
});
test('debris behind walls is excluded and JEV receives detached observed trajectories', () => {
  const r = fixture(),
    pilot = new Autoplay();
  r.debris = [piece(r)];
  pilot.setEnabled(true);
  pilot.plan(r);
  assert.equal(pilot.tactical.snapshot.visibleDebris.length, 1);
  r.debris[0].x += 4;
  assert.notEqual(pilot.tactical.snapshot.visibleDebris[0].x, r.debris[0].x);
  const world = { ...r.world, lineOfSight: () => false };
  Object.defineProperty(r, 'world', { value: world, configurable: true });
  assert.deepEqual(visibleDebris(r), []);
});
test('debris observations use current physics poses and are released with the body', async () => {
  await debrisPhysicsReady;
  const physics = new DebrisPhysics(),
    group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6)));
  group.position.set(1, 30, -5);
  const p = { group, velocity: new THREE.Vector3(2, -3, 4), spin: new THREE.Vector3() };
  try {
    physics.add(p);
    physics.update(1 / 60);
    const [o] = physics.observations();
    assert.equal(o.id, 1);
    assert(o.y < 30);
    assert(o.vy < -3);
    assert(o.vs < 0);
    assert.equal(o.gravity, 9.81);
    physics.remove(p);
    assert.deepEqual(physics.observations(), []);
  } finally {
    physics.dispose();
  }
});
test('autoplay safety prevents an otherwise lethal real-physics debris collision', async () => {
  await debrisPhysicsReady;
  const drive = (safe, falling) => {
    const physics = new DebrisPhysics(),
      session = new GameSession({ physics }),
      r = session.run;
    Object.assign(r, {
      x: -10000,
      s: -10000,
      yaw: 0,
      speed: 22,
      recognizers: [],
      enemyTanks: [],
      dataBeams: [],
    });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6)));
    group.position.set(r.x, falling ? 24 : 2, -r.s - 32);
    physics.add({
      group,
      velocity: new THREE.Vector3(0, falling ? -5 : 0, 0),
      spin: new THREE.Vector3(),
    });
    r.debris = physics.observations();
    try {
      for (let i = 0; i < 240 && !r.crushed; i++) {
        const desired = { throttle: 1, steer: 0 };
        session.advance(safe ? avoidDebris(r, desired).command : desired, 1 / 60);
      }
      return { crushed: r.crushed, health: r.health };
    } finally {
      session.dispose();
    }
  };
  for (const falling of [false, true]) {
    assert.equal(drive(false, falling).crushed, true);
    assert.deepEqual(drive(true, falling), { crushed: false, health: 3 });
  }
});
test('debris guard includes pending turbo acceleration and active turbo stopping distance', () => {
  const r = fixture();
  r.debris = [piece(r, { s: r.s + 80 })];
  assert(avoidDebris(r, { throttle: 1, steer: 0, turbo: true }).active);
  r.speed = 55;
  r.turboRemaining = 4;
  r.debris = [piece(r, { s: r.s + 65 })];
  assert(avoidDebris(r, { throttle: 1, steer: 0 }).active);
});

test('attack lead remains stable as distances change; supports leave the stomp column', async () => {
  const { coordinateAttacks, attackSupportGoal } =
    await import('../src/simulation/attack-coordination.js');
  const { maneuverOptions } = await import('../src/simulation/tactical.js');
  const { beginCrush } = await import('../src/simulation/crush.js');
  const r = createRun(1982),
    peers = r.recognizers.slice(0, 2);
  peers.forEach((e, i) =>
    Object.assign(e, {
      x: -10000 + i * 10,
      s: -10030,
      y: 80,
      yaw: 0,
      canSee: true,
      memory: { x: -10000, s: -10000, vx: 0, vs: 0, seenAt: 0 },
      nextAttack: 0,
    }),
  );
  coordinateAttacks(peers, 0);
  assert.equal(peers[0].attackAssignment.leaderId, peers[0].id);
  peers[1].x = -10000;
  peers[1].s = -10001;
  coordinateAttacks(peers, 1);
  assert(peers.every((e) => e.attackAssignment.leaderId === peers[0].id));
  const support = attackSupportGoal(peers[1], peers[1].memory);
  assert(Math.hypot(support.x + 10000, support.s + 10000) >= 90);
  const choices = maneuverOptions(peers[1], 1, peers);
  assert(choices.some((p) => p.kind === 'support'));
  assert(!choices.some((p) => ['strike', 'low-approach'].includes(p.kind)));
  peers[1].memory.seenAt = 1;
  peers[1].vx = peers[1].vs = 0;
  beginCrush(peers[1], 1);
  assert(!peers[1].attack);
  peers[0].state = 'destroyed';
  peers[0].health = 0;
  coordinateAttacks(peers, 2);
  assert.equal(peers[1].attackAssignment.leaderId, peers[1].id);
});
test('attack lease hands off a blocked lead and expires when no attack progresses', async () => {
  const { coordinateAttacks } = await import('../src/simulation/attack-coordination.js');
  const r = createRun(1982),
    peers = r.recognizers.slice(0, 2);
  peers.forEach((e, i) =>
    Object.assign(e, {
      x: -10000 + i * 10,
      s: -10020,
      y: 80,
      yaw: 0,
      canSee: true,
      memory: { x: -10000, s: -10000, vx: 0, vs: 0, seenAt: 0 },
      nextAttack: 0,
    }),
  );
  coordinateAttacks(peers, 0);
  const first = peers[0].id;
  peers[0].tactical = { blocked: true };
  coordinateAttacks(peers, 1);
  assert.equal(peers[1].attackAssignment.leaderId, peers[1].id);
  peers[0].tactical.blocked = false;
  coordinateAttacks(peers, 14);
  assert.equal(peers[0].attackAssignment.leaderId, first);
});
test('radio and tactical ally visibility use a quarter of each active world maze width', async () => {
  const { radioRangeFor } = await import('../src/game/communication.js');
  const { knownAllies } = await import('../src/simulation/tactical.js');
  for (const layout of ['authored', 'blueprint']) {
    const { world } = createScenario({ layout });
    const session = new GameSession({ world }),
      [a, b] = session.run.recognizers;
    const radius = radioRangeFor(a);
    assert.equal(radius, world.MAZE_LENGTH*.25);
    Object.assign(a, { x: 0, s: 0, y: 80 });
    Object.assign(b, { x: radius - 0.1, s: 0, y: 80 });
    assert(knownAllies(a, [a, b]).includes(b));
    b.x = radius + 0.1;
    assert(!knownAllies(a, [a, b]).includes(b));
    b.x = radius * 0.8;
    b.y = 80 + radius * 0.8;
    assert(!knownAllies(a, [a, b]).includes(b));
    session.dispose();
  }
});
test('two close tactical Recognizers give one attacker room to complete a stomp', () => {
  const session = new GameSession({ settings: { vehicle: { aiMode: 'local' } } }),
    r = session.run;
  Object.assign(r, { x: -10000, s: -10000, speed: 0, enemyTanks: [], dataBeams: [] });
  r.recognizers = r.recognizers.slice(0, 2);
  for (const [i, e] of r.recognizers.entries())
    Object.assign(e, {
      x: r.x + (i ? 24 : -24),
      s: r.s - 35,
      y: 80,
      vx: 0,
      vs: 0,
      vy: 0,
      yaw: i ? 0.6 : -0.6,
      yawVelocity: 0,
      canSee: true,
      memory: { x: r.x, s: r.s, vx: 0, vs: 0, seenAt: 0 },
      nextSense: 0,
      nextAttack: 0,
    });
  let committed = false;
  for (let i = 0; i < 1800 && !r.crushed; i++) {
    session.advance({}, 1 / 60);
    const striking = r.recognizers.filter(
      (e) => e.attack && ['fold', 'drop'].includes(e.attack.phase),
    );
    assert(striking.length <= 1);
    committed ||= striking.length === 1;
  }
  assert(committed);
  assert(r.crushed);
  session.dispose();
});

test('support formation stays assigned away from target and without personal line of sight',async()=>{
 const {coordinateAttacks,attackSupportGoal}=await import('../src/simulation/attack-coordination.js');
 const {maneuverOptions}=await import('../src/simulation/tactical.js');
 const template=createRun(1982).recognizers[0];
 const peers=Array.from({length:6},(_,id)=>({...template,id,x:-10000+id*8,s:-10020,y:80,health:3,canSee:true,memory:{x:-10000,s:-10000,vx:0,vs:0,seenAt:0},nextAttack:0}));
 coordinateAttacks(peers,0);const leader=peers[0].attackAssignment.leaderId;
 const supporters=peers.filter(e=>e.id!==leader),goals=supporters.map(e=>attackSupportGoal(e,e.memory));
 assert.equal(supporters.filter(e=>e.attackAssignment.role==='spotter').length,1);
 assert.ok(supporters.some(e=>e.attackAssignment.role==='cutoff'));
 for(let i=0;i<goals.length;i++)for(let j=i+1;j<goals.length;j++)assert.ok(Math.hypot(goals[i].x-goals[j].x,goals[i].s-goals[j].s)>=59.9);
 supporters.forEach((e,i)=>{Object.assign(e,goals[i]);e.canSee=false;});
 // A satellite outside the old 140 m recruitment radius must not rejoin the attack pile.
 supporters[0].x-=180;
 coordinateAttacks(peers,1);
 for(const e of supporters){
  assert.equal(e.attackAssignment.leaderId,leader);
  const choices=maneuverOptions(e,1,peers);assert.ok(choices.some(p=>p.kind==='support'));
  assert.ok(!choices.some(p=>['strike','low-approach','search-track'].includes(p.kind)));
 }
 coordinateAttacks(peers,40);assert.ok(peers.every(e=>!e.attackAssignment));
});

for(const mode of ['local','jev'])test(`two distant ${mode} attackers keep a progressing lead long enough to finish the stomp`,()=>{
 const session=new GameSession({settings:{vehicle:{aiMode:mode}}}),r=session.run;
 Object.assign(r,{x:-10000,s:-10000,speed:0,enemyTanks:[],dataBeams:[]});r.recognizers=r.recognizers.slice(0,2);
 r.recognizers.forEach((e,i)=>Object.assign(e,{x:r.x+(i?120:-120),s:r.s,y:80,yaw:i?Math.PI/2:-Math.PI/2,vx:0,vs:0,vy:0,yawVelocity:0,health:3,canSee:true,memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:0},nextSense:0,nextAttack:0,stompDisabled:false}));
 let lead;
 for(let i=0;i<2700&&!r.crushed;i++){
  session.advance({},1/60);
  if(mode==='jev')for(const e of r.recognizers){
   const t=e.tactical;if(!t||t.requested===t.revision)continue;
   const option=t.options?.find(o=>o.kind==='pursue');
   if(option&&!e.attack)assert.ok(applyTacticalChoice(e,{id:option.id,confidence:1},t.revision,r.time,r.time));
   t.requested=t.revision;
  }
  const assigned=r.recognizers.find(e=>e.attackAssignment)?.attackAssignment.leaderId;
  lead??=assigned;assert.equal(assigned,lead,'progressing lead must not be rotated out');
  assert.ok(r.recognizers.filter(e=>e.attack&&['fold','drop'].includes(e.attack.phase)).length<=1);
 }
 assert.ok(r.crushed,'must complete the approach and stomp within 45 seconds');session.dispose();
});

for(const choice of ['local','pursue','strike','low-approach'])test(`opening formation completes a prompt stomp with ${choice} decisions`,()=>{
 const session=new GameSession({settings:{vehicle:{aiMode:choice==='local'?'local':'jev'}}}),r=session.run;
 startPursuit(r);
 for(let i=0;i<2400&&!r.crushed;i++){
  session.advance({},1/60);
  if(choice!=='local')for(const e of r.recognizers){
   const t=e.tactical;if(!t||t.requested===t.revision)continue;
   const option=t.options?.find(o=>o.kind===choice);
   if(option&&!e.attack)assert.ok(applyTacticalChoice(e,{id:option.id,confidence:1},t.revision,r.time,r.time));
   t.requested=t.revision;
  }
 }
 assert.ok(r.crushed,`no stomp after ${r.time}s with ${choice}`);
 assert.ok(r.recognizers.some(e=>e.attack?.phase==='hold'&&e.health===3),'stomping does not cost health');
 session.dispose();
});

test('stomp landing crushes debris without self damage, but normal flight remains vulnerable',async()=>{
 const {applyDebrisImpacts}=await import('../src/simulation/debris-damage.js');
 const r=createRun(1982),e=r.recognizers[0],hit={target:`enemy:${e.id}`,energy:55000,point:{x:e.x,y:0,z:-e.s}};
 for(const phase of ['drop','hold']){e.attack={phase};applyDebrisImpacts(r,[hit]);assert.equal(e.health,3);}
 e.attack=null;applyDebrisImpacts(r,[hit]);assert.equal(e.health,2);
});

for(const choice of ['local','pursue','strike','low-approach'])test(`48-meter stomp respects normal yaw limits with ${choice} decisions`,()=>{
 for(let direction=0;direction<8;direction++){
  const session=new GameSession({settings:{vehicle:{aiMode:choice==='local'?'local':'jev'}}}),r=session.run;
  Object.assign(r,{x:-10000,s:-10000,enemyTanks:[],dataBeams:[]});r.recognizers=r.recognizers.slice(0,1);
  const e=r.recognizers[0];Object.assign(e,{x:r.x,s:r.s-48,y:80,yaw:direction*Math.PI/4,vx:0,vs:0,vy:0,yawVelocity:0,canSee:true,memory:{x:r.x,s:r.s,vx:0,vs:0,seenAt:0},nextSense:0});
  for(let i=0;i<1200&&!r.crushed;i++){
   const yawVelocity=e.yawVelocity,speed=Math.hypot(e.vx,e.vs);
   session.advance({},1/60);
   assert.ok(Math.hypot(e.vx,e.vs)<=speed+session.settings.flight.acceleration/60+1e-9,'close attacks must not boost thrust');
   assert.ok(Math.abs(e.yawVelocity)<=session.settings.flight.turnRate+1e-9);
   assert.ok(Math.abs(e.yawVelocity-yawVelocity)<=session.settings.flight.turnAcceleration/60+1e-9);
   const t=e.tactical;
   if(choice!=='local'&&t&&t.requested!==t.revision){
    const option=t.options?.find(o=>o.kind===choice);
    if(option&&!e.attack)assert.ok(applyTacticalChoice(e,{id:option.id,confidence:1},t.revision,r.time,r.time));
    t.requested=t.revision;
   }
  }
  assert.ok(r.crushed,`${choice}: heading ${direction*Math.PI/4} failed to complete the turn and stomp`);
  assert.equal(e.health,3);session.dispose();
 }
});

for(const mode of ['local','jev'])test(`near-head-on Clu is intercepted ahead of his path with ${mode} control`,()=>{
 // Wider crossings can now escape the half-speed lateral correction.
 for(const lateral of [0,20]){
  const session=new GameSession({settings:{vehicle:{aiMode:mode}}}),r=session.run;
  Object.assign(r,{x:-10000,s:-10000,yaw:0,speed:22,enemyTanks:[],dataBeams:[]});r.recognizers=r.recognizers.slice(0,1);
  const e=r.recognizers[0];Object.assign(e,{x:r.x+lateral,s:r.s+140,y:80,yaw:Math.PI,vx:0,vs:0,vy:0,yawVelocity:0,nextSense:0});
  let leadAtCommit;
  for(let i=0;i<480&&!r.crushed;i++){
   session.advance({throttle:1},1/60);
   if(e.attack&&leadAtCommit==null)leadAtCommit=e.s-r.s;
   const t=e.tactical;
   if(mode==='jev'&&t&&t.requested!==t.revision){
    const option=t.options?.find(o=>o.kind==='pursue');
    if(option&&!e.attack)assert.ok(applyTacticalChoice(e,{id:option.id,confidence:1},t.revision,r.time,r.time));
    t.requested=t.revision;
   }
  }
  assert.ok(leadAtCommit>40,'fold before the approaching target reaches the aircraft');
  assert.ok(r.crushed,`missed approach from ${lateral} m sideways`);assert.equal(e.health,3);session.dispose();
 }
});
