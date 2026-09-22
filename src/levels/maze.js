// Compatibility exports for historical authored-layout fixtures and reference tools.
// Gameplay selects and injects a scenario at bootstrap; core code never reads location.
import { DEFAULT_WORLD } from './scenario.js';
export const {
  MAZE_KIND,
  CELL,
  SIZE,
  HALF,
  WALL_HEIGHT,
  BASIS,
  SPAWN,
  GRID,
  gridToWorld,
  worldToGrid,
  cellAt,
  cellCenter,
  solidCell,
  insideWall,
  closestWallPoint,
  MAZE_INSTANCES,
  WALLS,
  OPEN_CELLS,
  nearbyWalls,
  wallAt,
  freePosition,
  wallIntersection,
  lineOfSight,
  FLOOR_HALF,
  MAZE_LENGTH,
  PURSUER_COUNT,
  PATROL_COUNT,
  RECOGNIZER_STARTS,
} = DEFAULT_WORLD;
export const OPENING_STARTS = RECOGNIZER_STARTS.slice(0, PURSUER_COUNT);
