import { MinHeap } from '../util/min-heap.js';
import { worldFor } from '../levels/scenario.js';
import { configFor } from '../game/config.js';
export const GROUND_SEARCH = Object.freeze({
  partialProgressMeters: 12,
  goalShiftMeters: 12,
  nodesPerTick: 192,
  nodesPerSlice: 24,
});
// Local A*: all edges are swept against the same expanded walls as the hull.
export function* searchGroundRoute(
  start,
  goal,
  {
    longRange = false,
    cellMeters = 12,
    maxIterations = 2500,
    detourMeters = 500,
    allowPartial = false,
    world = worldFor(start),
    vehicleConfig = configFor(start),
  } = {},
) {
  const config = vehicleConfig;
  const clear = (a, b) =>
    world.wallIntersection({ ...a, y: 2 }, { ...b, y: 2 }, config.tankRadius + 0.5) === null;
  // A sighting can be closer to a wall than our route margin. Approach a nearby
  // clear point rather than discarding the entire radio-directed route.
  if (!clear(goal, goal)) {
    const candidates = [];
    for (const radius of [4, 8, 16, 24])
      for (let i = 0; i < 16; i++) {
        const p = {
          x: goal.x + Math.cos((i * Math.PI) / 8) * radius,
          s: goal.s + Math.sin((i * Math.PI) / 8) * radius,
        };
        if (clear(p, p)) candidates.push(p);
      }
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - goal.x, a.s - goal.s) - Math.hypot(b.x - goal.x, b.s - goal.s) ||
        Math.hypot(a.x - start.x, a.s - start.s) - Math.hypot(b.x - start.x, b.s - start.s),
    );
    if (!candidates.length) return [];
    goal = candidates[0];
  }
  if (clear(start, goal)) return [goal];
  const cell = cellMeters,
    open = new MinHeap((n) => n.g + Math.hypot(n.x - goal.x, n.s - goal.s), true),
    seen = new Map([['0,0', 0]]);
  let closest = { x: start.x, s: start.s, g: 0, key: '0,0', ix: 0, is: 0 };
  open.push(closest);
  const pathTo = (n) => {
    const path = [];
    for (let p = n; p.parent; p = p.parent) path.unshift({ x: p.x, s: p.s });
    return path;
  };
  for (let iteration = 0; open.length && iteration < maxIterations; iteration++) {
    yield;
    const n = open.pop();
    if (Math.hypot(n.x - goal.x, n.s - goal.s) < Math.hypot(closest.x - goal.x, closest.s - goal.s))
      closest = n;
    if ((longRange || Math.hypot(n.x - goal.x, n.s - goal.s) < 24) && clear(n, goal))
      return [...pathTo(n), goal];
    for (let dx = -1; dx <= 1; dx++)
      for (let ds = -1; ds <= 1; ds++) {
        if (!dx && !ds) continue;
        const ix = n.ix + dx,
          is = n.is + ds,
          key = ix + ',' + is,
          g = n.g + cell * Math.hypot(dx, ds);
        if (
          g > Math.hypot(goal.x - start.x, goal.s - start.s) + detourMeters ||
          g >= (seen.get(key) ?? Infinity)
        )
          continue;
        const p = { x: start.x + ix * cell, s: start.s + is * cell };
        if (!clear(n, p)) continue;
        seen.set(key, g);
        open.push({ ...p, ix, is, key, g, parent: n });
      }
  }
  if (
    allowPartial &&
    Math.hypot(start.x - goal.x, start.s - goal.s) -
      Math.hypot(closest.x - goal.x, closest.s - goal.s) >=
      GROUND_SEARCH.partialProgressMeters
  )
    return pathTo(closest);
  return [];
}

// Synchronous adapter for startup, player mission construction and offline tests.
export function groundRoute(start, goal, options) {
  const search = searchGroundRoute(start, goal, options);
  let result;
  do {
    result = search.next();
  } while (!result.done);
  return result.value;
}
// Enemy searches share a bounded node budget, rotated fairly between units.
// Generators stay outside serializable simulation snapshots.
export class GroundRoutePlanner {
  constructor() {
    this.jobs = new Map();
    this.completed = new Map();
  }
  request(unit, goal, options, fallback) {
    const old = this.jobs.get(unit);
    if (old && Math.hypot(goal.x - old.goal.x, goal.s - old.goal.s) < GROUND_SEARCH.goalShiftMeters)
      return;
    this.completed.delete(unit);
    const start = { x: unit.x, s: unit.s };
    this.jobs.set(unit, {
      goal: { ...goal },
      search: searchGroundRoute(start, goal, options),
      fallback,
      start,
    });
  }
  update(active) {
    const live = new Set(active);
    for (const unit of this.jobs.keys()) if (!live.has(unit)) this.jobs.delete(unit);
    for (const unit of this.completed.keys()) if (!live.has(unit)) this.completed.delete(unit);
    let remaining = GROUND_SEARCH.nodesPerTick;
    while (remaining > 0 && this.jobs.size) {
      const [unit, job] = this.jobs.entries().next().value;
      this.jobs.delete(unit);
      for (let n = 0; n < GROUND_SEARCH.nodesPerSlice && remaining > 0; n++) {
        const result = job.search.next();
        remaining--;
        if (!result.done) continue;
        if (!result.value.length && job.fallback) {
          job.search = searchGroundRoute(job.start, job.goal, job.fallback);
          job.fallback = null;
        } else {
          this.completed.set(unit, { goal: job.goal, path: result.value });
          job.done = true;
          break;
        }
      }
      if (!job.done) this.jobs.set(unit, job);
    }
    return GROUND_SEARCH.nodesPerTick - remaining;
  }
  take(unit) {
    const result = this.completed.get(unit);
    this.completed.delete(unit);
    return result;
  }
  cancel(unit) {
    this.jobs.delete(unit);
    this.completed.delete(unit);
  }
}
