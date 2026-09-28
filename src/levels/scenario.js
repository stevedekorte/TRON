import { createMazeWorld } from './maze-world.js';
import * as authored from './authored-maze.js';
import {blueprintSource} from './blueprint-source.js';
import * as labyrinth from './labyrinth-maze.js';

/** A serializable recipe. Browser preferences are resolved by bootstrap, never here. */
export function scenarioSpec({
  layout = 'authored',
  layoutSeed = 1982,
  runSeed = 1982,
  siteCount = 4,
  centralLabyrinth = false,
  outerMazes = true,
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
    centralLabyrinth:!!centralLabyrinth,
    outerMazes:!centralLabyrinth||!!outerMazes,
  });
}

export function createScenario(options = {}) {
  const spec = scenarioSpec(options);
  const base = spec.layout === 'blueprint' ? blueprintSource(spec.outerMazes) : authored;
  const geometry = createMazeWorld(base, spec.layoutSeed, spec.siteCount,spec.centralLabyrinth?labyrinth:null,spec.outerMazes);
  const FLOOR_HALF = base.FLOOR_HALF || [base.HALF, base.HALF];
  const MAZE_LENGTH = Math.max(
    2 * FLOOR_HALF[0] * Math.hypot(base.BASIS.a, base.BASIS.c),
    2 * FLOOR_HALF[1] * Math.hypot(base.BASIS.b, base.BASIS.d),
  );
  const patrols = geometry.instances.flatMap((m) => Array.from({length:m.patrols?.airCount??1},(_,patrolSector)=>({
    ...geometry.openCells.find((p) => p.mazeId === m.id),
    mazeId: m.id,
    patrolSector:m.patrols?patrolSector:undefined,
  })));
  let spawn=base.SPAWN,opening=base.RECOGNIZER_STARTS.slice(0,5);
  if(spec.centralLabyrinth&&!spec.outerMazes){
    const center=geometry.instances[0],approachDistance=-base.SPAWN.s-FLOOR_HALF[1];
    spawn={...base.SPAWN,x:center.x+base.SPAWN.x,s:center.bounds.minS-approachDistance};
    const dx=spawn.x-base.SPAWN.x,ds=spawn.s-base.SPAWN.s;
    opening=opening.map(p=>({...p,x:p.x+dx,s:p.s+ds}));
  }
  const world = {
    ...base,
    ...geometry,
    spec,
    revision: `${spec.layout}:${spec.layoutSeed}:${spec.siteCount}:${spec.centralLabyrinth}:${spec.outerMazes}`,
    MAZE_KIND: spec.layout,
    FLOOR_HALF,
    MAZE_LENGTH,
    PURSUER_COUNT: 5,
    PATROL_COUNT: patrols.length,
    MAZE_INSTANCES: geometry.instances,
    WALLS: geometry.walls,
    OPEN_CELLS: geometry.openCells,
    SPAWN:spawn,
    RECOGNIZER_STARTS: [...opening, ...patrols],
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
