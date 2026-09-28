import {createTeleportPads} from '../src/levels/teleporters.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createScenario } from '../src/levels/scenario.js';
import { GameSession } from '../src/simulation/game-session.js';
import { GameLoop, LOOP_TIMING, simulationStepSeconds } from '../src/app/game-loop.js';
import { InputController } from '../src/app/input-controller.js';
import { RouteFollower } from '../src/simulation/route-follower.js';
import { Autoplay } from '../src/simulation/autoplay.js';
import { JevTransport } from '../src/ai/jev-transport.js';
import { JevRequestPolicy } from '../src/ai/jev-request-policy.js';
import { config } from '../src/game/config.js';
import { carrierFor } from '../src/game/carrier.js';

const silent = (session) => {
  session.run.recognizers = [];
  session.run.enemyTanks = [];
  return session;
};
test('authored and blueprint sessions coexist, replay placements, and isolate configuration', () => {
  const a = createScenario({ layout: 'authored', layoutSeed: 10, siteCount: 1 }),
    b = createScenario({ layout: 'blueprint', layoutSeed: 20 });
  const x = new GameSession({ world: a.world }),
    y = new GameSession({ world: b.world, seed: 1982 }),
    replay = new GameSession({ world: b.world });
  assert.equal(x.run.teleportPads.length, 0);
  assert.equal(y.run.teleportPads.length, 0);
  assert.equal(x.run.dataBeams.length, 1);
  assert.equal(y.run.dataBeams.length, 4);
  assert.equal(x.run.enemyTanks.length, 5);
  assert.equal(y.run.enemyTanks.length, 14);
  assert.notEqual(carrierFor(a.world).startX, carrierFor(b.world).startX);
  assert.deepEqual(y.snapshot(), replay.snapshot());
  assert.notDeepEqual(
    createScenario({ layout: 'blueprint', layoutSeed: 21 }).world.MAZE_INSTANCES.map(
      (m) => m.angle,
    ),
    b.world.MAZE_INSTANCES.map((m) => m.angle),
  );
  assert(y.run.recognizers.every((e) => e.world === b.world && e.settings === y.settings));
  silent(x);
  silent(y);
  silent(replay);
  for (const s of [x, y, replay]) s.place({ x: -20000, s: -20000, yaw: 0, speed: 0 });
  x.configure('vehicle', { maxSpeed: 1, acceleration: 1 });
  for (let i = 0; i < 120; i++) {
    x.advance({ throttle: 1 }, 1 / 60);
    y.advance({ throttle: 1 }, 1 / 60);
    replay.advance({ throttle: 1 }, 1 / 60);
  }
  assert(x.run.speed <= 1);
  assert(y.run.speed > 10);
  assert.deepEqual(y.snapshot(), replay.snapshot());
  assert.equal(config.maxSpeed, 22, 'session tuning never changes module defaults');
  const snap = y.snapshot();
  snap.dataBeams[0].x = Infinity;
  assert(Number.isFinite(y.run.dataBeams[0].x));
});
test('session preserves debris/event ordering, drains once, and suppresses teleport interpolation', () => {
  const order = [],
    physics = {
      clear() {},
      syncVehicles() {
        order.push('sync');
      },
      update() {
        order.push('physics');
      },
      drainImpacts() {
        order.push('impacts');
        return [];
      },
      dispose() {
        order.push('dispose');
      },
    };
  const session = silent(new GameSession({ seed: 1982, physics }));
  session.attachDebris(physics, {
    update() {
      order.push('visual');
    },
    clear() {},
  });
  session.run.events.push({ type: 'fixture' });
  const events = session.advance({}, 1 / 60);
  assert.deepEqual(order, ['sync', 'physics', 'visual', 'impacts']);
  assert.equal(events[0].type, 'fixture');
  assert.equal(session.run.events.length, 0);
  assert(!session.advance({}, 1 / 60).some((e) => e.type === 'fixture'));
  session.run.teleportPads=createTeleportPads();
  const pad = session.run.teleportPads[0];
  session.place({ x: pad.x, s: pad.s, speed: 0 });
  const revision = session.run.teleportRevision;
  session.advance({}, 1 / 60);
  assert.equal(session.run.teleportRevision, revision + 1);
  assert.equal(session.previous.x, session.run.x);
  assert.equal(session.previous.s, session.run.s);
  session.dispose();
  session.dispose();
  assert.equal(order.filter((s) => s === 'dispose').length, 1);
});
test('loop owns one callback, bounds catchup, honors pause and cancels stale scheduled work', () => {
  let now = 0,
    hidden = false,
    allowed = false,
    id = 0;
  const pending = new Map();
  let ticks = 0,
    steps = 0,
    playing = true;
  const schedule = (fn) => {
      pending.set(++id, fn);
      return id;
    },
    cancel = (id) => pending.delete(id);
  const loop = new GameLoop({
    clock: () => now,
    hidden: () => hidden,
    backgroundAllowed: () => allowed,
    requestFrame: schedule,
    cancelFrame: cancel,
    setTimer: schedule,
    clearTimer: cancel,
    frame(dt, background) {
      ticks++;
      if (playing)
        loop.advance(
          dt,
          background,
          () => playing,
          () => steps++,
        );
    },
  });
  const tick = (ms) => {
    now = ms;
    const [key, fn] = pending.entries().next().value;
    pending.delete(key);
    fn(ms);
  };
  loop.start();
  loop.start();
  assert.equal(pending.size, 1);
  tick(0);
  tick(100);
  assert.equal(steps, 6);
  playing = false;
  loop.resetAccumulator();
  tick(500);
  assert.equal(steps, 6);
  hidden = true;
  allowed = true;
  playing = true;
  loop.reschedule();
  tick(1500);
  assert(steps >= 65 && steps <= 66);
  assert.equal(pending.size, 1);
  const stale = pending.values().next().value;
  loop.reschedule();
  const before = ticks;
  stale(1700);
  assert.equal(ticks, before);
  loop.dispose();
  loop.dispose();
  assert.equal(pending.size, 0);
  assert.equal(LOOP_TIMING.fixedSeconds, 1 / 60);
});
test('input clears queued actions and removes owned listeners on dispose', () => {
  const input = new InputController(),
    target = new EventTarget();
  let calls = 0;
  input.listen(target, 'test', () => calls++);
  target.dispatchEvent(new Event('test'));
  input.keys.add('KeyW');
  input.fireQueued = true;
  input.mouseFire = true;
  assert.equal(input.command({}, { mouseLook: null }).throttle, 1);
  input.consume();
  assert.equal(input.fireQueued, false);
  assert.equal(input.mouseFire, true);
  input.dispose();
  target.dispatchEvent(new Event('test'));
  assert.equal(calls, 1);
  assert.equal(input.keys.size, 0);
  assert.equal(input.mouseFire, false);
});
test('route snapshots are detached and same-option confirmations preserve progress', () => {
  const session = silent(new GameSession({ seed: 1982 }));
  session.place({ x: -20000, s: -20000, yaw: 0, speed: 0 });
  const r = session.run,
    a = new Autoplay();
  a.setEnabled(true);
  a.input(r);
  const snapshot = structuredClone(a.tactical.snapshot),
    index = a.follower.index;
  a.tactical.plan.route[0].x += 1;
  assert.deepEqual(a.tactical.snapshot, snapshot);
  assert(a.apply({ id: a.tactical.plan.id, confidence: 1 }, a.tactical.revision, r.time, r));
  assert.equal(a.follower.index, index);
  const f = new RouteFollower(),
    plan = {
      id: 'm0',
      kind: 'collect-data',
      goal: { x: r.x, s: r.s + 50 },
      route: [
        { x: r.x, s: r.s + 10 },
        { x: r.x, s: r.s + 50 },
      ],
    };
  f.accept(plan, 1, r);
  assert.deepEqual(
    f.route.waypoints.map((p) => p.kind),
    ['corner', 'stop'],
  );
  const result = f.update(r);
  assert.equal(result.status, 'following');
  assert.equal(result.command.throttle, 1);
  assert(Math.abs(f.progress.headingError) < 1e-9);
  f.accept(plan, 1, r);
  assert.equal(f.index, 1, 'visible shortcut cursor survives confirmation');
});
test('transport deadlines are distinct from cancellation and typed service failures', async () => {
  let deadline;
  const transport = new JevTransport({
    setTimer: (fn) => ((deadline = fn), 1),
    clearTimer: () => {},
    fetchImpl: (_url, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      ),
  });
  const controller = new AbortController(),
    timeout = transport.request({}, controller.signal);
  deadline();
  await assert.rejects(timeout, (e) => e.code === 'timeout');
  const cancelled = transport.request({}, controller.signal);
  controller.abort();
  await assert.rejects(cancelled, (e) => e.code === 'cancelled');
  transport.fetchImpl = async () =>
    Response.json({ code: 'unavailable', error: 'Not a timeout' }, { status: 503 });
  await assert.rejects(
    transport.request({}, new AbortController().signal),
    (e) => e.code === 'unavailable',
  );
});
test('request policy uses injected clock and preserves cooldown across rounds', () => {
  let now = 1000;
  const p = new JevRequestPolicy({ clock: () => now });
  p.sent(0, 0.6);
  assert.equal(p.ready(1), false);
  now = 1650;
  assert(p.ready(1));
  assert(p.retryTimeout(1));
  assert.equal(p.nextRequestMs, 2150);
  now = 2150;
  assert(p.retryTimeout(2));
  assert.equal(p.nextRequestMs, 3150);
  assert.equal(p.retryTimeout(3), false);
  p.failed(3, 60);
  p.resetRound();
  assert.equal(p.timeoutFailures, 0);
  assert(p.coolingDown);
  now += 60000;
  assert(!p.coolingDown);
});

test('transport never binds native fetch to the transport instance', async () => {
  let receiver;
  const transport = new JevTransport({
    fetchImpl: function () {
      receiver = this;
      return Promise.resolve(Response.json({ id: 'm0', confidence: 1 }));
    },
  });
  await transport.request({}, new AbortController().signal);
  assert.equal(receiver, undefined);
});

test('cycle-only 120 Hz steps preserve elapsed time and render alpha',()=>{
 const loop=new GameLoop({frame:()=>{}}),steps=[];
 loop.advance(1/60,false,()=>true,dt=>steps.push(dt),LOOP_TIMING.cycleFixedSeconds);
 assert.equal(steps.length,2);assert(steps.every(dt=>dt===1/120));
 loop.advance(1/240,false,()=>true,()=>{},LOOP_TIMING.cycleFixedSeconds);
 assert(Math.abs(loop.alpha-.5)<1e-9);
 loop.advance(1/60,false,()=>true,()=>{});
 assert(Math.abs(loop.alpha-.25)<1e-9);
});

test('120 Hz is confined to arena racing; the outside world uses its normal 60 Hz step',()=>{
 const r={playerVehicle:'tank'};assert.equal(simulationStepSeconds(r),1/60);
 r.playerVehicle='cycle';r.cycleRace={playerId:0,cycles:[{escaped:false,alive:true}]};
 assert.equal(simulationStepSeconds(r),1/120);
 r.cycleRace.cycles[0].escaped=true;assert.equal(simulationStepSeconds(r),1/60);
 r.cycleRace.cycles[0].alive=false;assert.equal(simulationStepSeconds(r),1/60);
 r.cycleRace.cycles[0].escaped=false;assert.equal(simulationStepSeconds(r),1/120);
});
