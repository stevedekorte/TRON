import {createMazeWorld} from './maze-world.js';
// Play the blueprint by default. Preserve the original studio cameras and Node fixtures.
import * as authored from './authored-maze.js';
import * as blueprint from './blueprint-maze.js';
const requested=typeof location!=='undefined'?new URLSearchParams(location.search).get('maze'):null;
const defaultKind=typeof location==='undefined'||location.pathname.endsWith('/reference.html')?'authored':'blueprint';
export const MAZE_KIND=requested==='authored'||requested==='blueprint'?requested:defaultKind;
const maze=MAZE_KIND==='blueprint'?blueprint:authored;
export const {CELL,SIZE,HALF,WALL_HEIGHT,BASIS,SPAWN,RECOGNIZER_STARTS:OPENING_STARTS,GRID,gridToWorld,worldToGrid,cellAt,cellCenter,solidCell,insideWall,closestWallPoint}=maze;
// Keep the layout stable across development hot reloads and module imports.
const seedKey=Symbol.for('space-paranoids.maze-layout-seed');
const layoutSeed=typeof window==='undefined'?1982:(globalThis[seedKey]??=Math.floor(Math.random()*4294967296));
const world=createMazeWorld(maze,layoutSeed,typeof location!=='undefined'&&location.pathname.endsWith('/reference.html')?1:4);
export const {instances:MAZE_INSTANCES,walls:WALLS,openCells:OPEN_CELLS,nearbyWalls,wallAt,freePosition,wallIntersection,lineOfSight}=world;
export const FLOOR_HALF=maze.FLOOR_HALF||[HALF,HALF];

export const MAZE_LENGTH=Math.max(2*FLOOR_HALF[0]*Math.hypot(BASIS.a,BASIS.c),2*FLOOR_HALF[1]*Math.hypot(BASIS.b,BASIS.d));
export const PURSUER_COUNT=2;
export const PATROL_COUNT=MAZE_INSTANCES.length;
// Seeded random placement is repeatable on restart for visual/behavior comparisons.
const patrols=MAZE_INSTANCES.map(m=>({...OPEN_CELLS.find(p=>p.mazeId===m.id),mazeId:m.id}));
export const RECOGNIZER_STARTS=[...OPENING_STARTS.slice(0,PURSUER_COUNT),...patrols];
