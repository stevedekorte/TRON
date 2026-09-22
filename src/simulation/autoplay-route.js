import { configFor } from '../game/config.js';
import { worldFor, DEFAULT_WORLD, attachWorld } from '../levels/scenario.js';
import { config } from '../game/config.js';
import { groundRoute } from './ground-tanks.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.s - b.s);
const margin = 32;
const MISSION_SEARCH = { longRange: true, cellMeters: 8, maxIterations: 12000, detourMeters: 4000 };
// Long open-grid legs connect bounded local maze routes. Corners allow travel
// around an intervening maze without expanding thousands of 12 m A* cells.
export function autoplayRoute(start, goal, world = worldFor(start)) {
  const config = configFor(start);
  const { MAZE_INSTANCES } = world,
    clear = (a, b) =>
      world.wallIntersection({ ...a, y: 2 }, { ...b, y: 2 }, config.tankRadius + 0.5) === null;
  if (clear(start, goal)) return [goal];
  // Search outward from the constrained destination first. Searching inward
  // from the open grid exhausted the local A* budget outside the blueprint.
  const reverse = groundRoute(
    goal,
    { x: start.x, s: start.s },
    { ...MISSION_SEARCH, world, vehicleConfig: config },
  );
  if (reverse.length) return [...reverse.slice(0, -1).reverse(), { x: goal.x, s: goal.s }];
  const nearest = (p) =>
    MAZE_INSTANCES.slice().sort(
      (a, b) =>
        distance(p, {
          x: (a.bounds.minX + a.bounds.maxX) / 2,
          s: (a.bounds.minS + a.bounds.maxS) / 2,
        }) -
        distance(p, {
          x: (b.bounds.minX + b.bounds.maxX) / 2,
          s: (b.bounds.minS + b.bounds.maxS) / 2,
        }),
    )[0];
  const nodes = [start, goal];
  for (const maze of MAZE_INSTANCES) {
    const b = maze.bounds;
    for (const x of [b.minX - margin, b.maxX + margin])
      for (const s of [b.minS - margin, b.maxS + margin]) nodes.push({ x, s });
  }
  for (const p of [start, goal]) {
    const b = nearest(p).bounds;
    nodes.push(
      { x: p.x, s: b.minS - margin },
      { x: p.x, s: b.maxS + margin },
      { x: b.minX - margin, s: p.s },
      { x: b.maxX + margin, s: p.s },
    );
  }
  const costs = nodes.map(() => Infinity),
    paths = new Map(),
    previous = new Map(),
    pending = new Set(nodes.map((_, i) => i));
  costs[0] = 0;
  while (pending.size) {
    const i = [...pending].sort((a, b) => costs[a] - costs[b])[0];
    if (!Number.isFinite(costs[i])) break;
    pending.delete(i);
    if (i === 1) {
      const segments = [];
      for (let n = 1; n !== 0; n = previous.get(n)) segments.unshift(paths.get(n));
      return segments.flat();
    }
    for (const j of pending) {
      const a = nodes[i],
        b = nodes[j];
      let route;
      if (clear(a, b)) route = [b];
      else if ((i === 0 || j === 1) && distance(a, b) < 2000)
        route = groundRoute(a, b, { longRange: true, world, vehicleConfig: config });
      else continue;
      if (!route.length) continue;
      let length = 0,
        last = a;
      for (const p of route) {
        length += distance(last, p);
        last = p;
      }
      if (costs[i] + length < costs[j]) {
        costs[j] = costs[i] + length;
        previous.set(j, i);
        paths.set(j, route);
      }
    }
  }
  return [];
}
