import { createMazeWorld } from './maze-world.js';
import * as authored from './authored-maze.js';
import * as blueprint from './blueprint-maze.js';

/** A serializable recipe. Browser preferences are resolved by bootstrap, never here. */
export function scenarioSpec({
  layout = 'authored',
  layoutSeed = 1982,
  runSeed = 1982,
  siteCount = 4,
  ...settings
} = {}) {
  if (!['authored', 'blueprint'].includes(layout)) throw new Error(`Unknown maze: ${layout}`);
  if (!Number.isInteger(siteCount) || siteCount < 1 || siteCount > 4)
    throw new Error('Expected 1–4 maze sites');
  return Object.freeze({
    ...settings,
    layout,
    layoutSeed: layoutSeed >>> 0,
    runSeed: runSeed >>> 0,
    siteCount,
  });
}

export function createScenario(options = {}) {
  const spec = scenarioSpec(options);
  const base = spec.layout === 'blueprint' ? blueprint : authored;
  const geometry = createMazeWorld(base, spec.layoutSeed, spec.siteCount);
  const FLOOR_HALF = base.FLOOR_HALF || [base.HALF, base.HALF];
  const MAZE_LENGTH = Math.max(
    2 * FLOOR_HALF[0] * Math.hypot(base.BASIS.a, base.BASIS.c),
    2 * FLOOR_HALF[1] * Math.hypot(base.BASIS.b, base.BASIS.d),
  );
  const patrols = geometry.instances.map((m) => ({
    ...geometry.openCells.find((p) => p.mazeId === m.id),
    mazeId: m.id,
  }));
  const world = {
    ...base,
    ...geometry,
    spec,
    revision: `${spec.layout}:${spec.layoutSeed}:${spec.siteCount}`,
    MAZE_KIND: spec.layout,
    FLOOR_HALF,
    MAZE_LENGTH,
    PURSUER_COUNT: 5,
    PATROL_COUNT: geometry.instances.length,
    MAZE_INSTANCES: geometry.instances,
    WALLS: geometry.walls,
    OPEN_CELLS: geometry.openCells,
    RECOGNIZER_STARTS: [...base.RECOGNIZER_STARTS.slice(0, 5), ...patrols],
  };
  return { spec, world };
}

// Legacy standalone function fixtures use one explicit, deterministic authored world.
// New sessions pass their own world; there is no mutable current-world singleton.
export const DEFAULT_SCENARIO = createScenario();
export const DEFAULT_WORLD = DEFAULT_SCENARIO.world;
export const worldFor = (record) => record?.world || DEFAULT_WORLD;
export function attachWorld(record, world) {
  Object.defineProperty(record, 'world', { value: world, configurable: true });
  return record;
}
