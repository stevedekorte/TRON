import test from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap } from '../src/util/min-heap.js';
import {
  GroundRoutePlanner,
  GROUND_SEARCH,
  groundRoute,
} from '../src/simulation/ground-routing.js';
import { createScenario } from '../src/levels/scenario.js';
import { GameSession } from '../src/simulation/game-session.js';
import { TACTICAL } from '../src/game/tactical.js';

test('route priority queues preserve priority and stable tie order', () => {
  for (const newestFirst of [false, true]) {
    const values = Array.from({ length: 100 }, (_, id) => ({ id, score: (id * 17) % 13 }));
    const heap = new MinHeap((v) => v.score, newestFirst);
    for (const v of values) heap.push(v);
    const actual = [];
    while (heap.length) actual.push(heap.pop());
    assert.deepEqual(
      actual,
      values.sort((a, b) => a.score - b.score || (newestFirst ? b.id - a.id : a.id - b.id)),
    );
    assert.equal(heap.pop(), undefined);
  }
});
test('ground searches are bounded, fair, and match the synchronous route', () => {
  const { world } = createScenario({ layout: 'blueprint', layoutSeed: 1982 });
  const start = { x: 404.0666666666667, s: -153.26666666666665 },
    goal = world.OPEN_CELLS.find((p) => p.mazeId === 0);
  const options = { world, cellMeters: 8, maxIterations: 12000, detourMeters: 4000 };
  const planner = new GroundRoutePlanner(),
    short = { x: -5000, s: -5000 };
  planner.request(start, goal, options);
  planner.request(short, { x: -4990, s: -5000 }, options);
  const first = planner.update([start, short]);
  assert.ok(first <= GROUND_SEARCH.nodesPerTick);
  assert.ok(planner.take(short)?.path.length, 'short job is not blocked by the long search');
  let result = planner.take(start);
  for (let i = 0; i < 150 && !result; i++) {
    assert.ok(planner.update([start]) <= GROUND_SEARCH.nodesPerTick);
    result = planner.take(start);
  }
  assert.ok(result?.path.length);
  assert.deepEqual(result.path, groundRoute(start, goal, options));
  planner.request(start, goal, options);
  planner.cancel(start);
  assert.equal(planner.update([start]), 0);
  planner.request(start, goal, options);
  planner.update([]);
  assert.equal(planner.jobs.size, 0);
});
test('changed destinations replace pending work and rounds do not share budgets', () => {
  const { world } = createScenario({ layout: 'blueprint', layoutSeed: 1982 });
  const planner = new GroundRoutePlanner(),
    unit = { x: -5000, s: -5000 };
  planner.request(unit, { x: -4900, s: -5000 }, { world });
  planner.request(unit, { x: -5000, s: -4800 }, { world });
  planner.update([unit]);
  assert.deepEqual(planner.take(unit).goal, { x: -5000, s: -4800 });
  const sessions = [
    new GameSession({ world, settings: { vehicle: { aiMode: 'local' } } }),
    new GameSession({ world, settings: { vehicle: { aiMode: 'local' } } }),
  ];
  try {
    for (const session of sessions) {
      const r = session.run;
      r.recognizers = r.recognizers.slice(0, 5);
      r.enemyTanks = [];
      r.dataBeams = [];
      r.x = -9000;
      r.s = -9000;
      for (const [i, e] of r.recognizers.entries())
        Object.assign(e, {
          x: -5000 + i * 50,
          s: -5000,
          y: 100,
          nextSense: Infinity,
          nextAttack: Infinity,
          canSee: true,
          memory: { x: -4900, s: -4900, vx: 0, vs: 0, seenAt: 0 },
        });
      for (let i = 0; i < 8; i++) {
        const before = r.recognizers.map((e) => e.tactical?.revision || 0);
        session.advance({}, 1 / 60);
        assert.ok(
          r.recognizers.filter((e, j) => (e.tactical?.revision || 0) > before[j]).length <=
            TACTICAL.plansPerTick,
        );
      }
      assert.ok(
        r.recognizers.every((e) => e.tactical?.plan),
        'every waiting unit receives a plan',
      );
    }
  } finally {
    for (const s of sessions) s.dispose();
  }
});
