import { createScenario } from '../src/levels/scenario.js';
import { GameSession } from '../src/simulation/game-session.js';
const { world } = createScenario({ layout: 'blueprint', layoutSeed: 1982 });
const session = new GameSession({ world, settings: { vehicle: { aiMode: 'local' } } }),
  r = session.run;
const target = world.OPEN_CELLS.find((p) => p.mazeId === 0);
Object.assign(r, { x: target.x, s: target.s, speed: 0, health: 100000, dataBeams: [] });
r.recognizers = r.recognizers.slice(0, 5);
r.enemyTanks = r.enemyTanks.filter((e) => e.mazeId === 0);
for (const [i, e] of r.recognizers.entries())
  Object.assign(e, {
    x: target.x + 80 + i * 25,
    s: target.s + 100,
    y: 100,
    stompDisabled: true,
    nextSense: Infinity,
    canSee: true,
  });
for (const e of [...r.recognizers, ...r.enemyTanks]) {
  e.memory = { x: target.x, s: target.s, vx: 0, vs: 0, seenAt: 0, source: 0 };
  e.nextSense = Infinity;
}
const samples = [];
for (let i = 0; i < 1200; i++) {
  for (const e of [...r.recognizers, ...r.enemyTanks]) {
    e.memory.seenAt = r.time;
    e.memory.s = target.s + Math.sin(i / 120) * 15;
  }
  const start = performance.now();
  session.advance({}, 1 / 60);
  samples.push({ ms: performance.now() - start, t: r.time });
}
samples.sort((a, b) => a.ms - b.ms);
console.log(
  JSON.stringify(
    {
      totalMs: samples.reduce((a, b) => a + b.ms, 0),
      p95: samples[Math.floor(samples.length * 0.95)],
      worst: samples.slice(-8),
    },
    null,
    2,
  ),
);
session.dispose();
