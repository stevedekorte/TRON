// Play the blueprint by default. Preserve the original studio cameras and Node fixtures.
import * as authored from './authored-maze.js';
import * as blueprint from './blueprint-maze.js';
const requested=typeof location!=='undefined'?new URLSearchParams(location.search).get('maze'):null;
const defaultKind=typeof location==='undefined'||location.pathname.endsWith('/reference.html')?'authored':'blueprint';
export const MAZE_KIND=requested==='authored'||requested==='blueprint'?requested:defaultKind;
const maze=MAZE_KIND==='blueprint'?blueprint:authored;
export const {CELL,SIZE,HALF,WALL_HEIGHT,BASIS,SPAWN,RECOGNIZER_STARTS:OPENING_STARTS,GRID,OPEN_CELLS,WALLS,gridToWorld,worldToGrid,cellAt,cellCenter,solidCell,insideWall,wallAt,nearbyWalls,closestWallPoint,freePosition,wallIntersection,lineOfSight}=maze;
export const FLOOR_HALF=maze.FLOOR_HALF||[HALF,HALF];

export const MAZE_LENGTH=Math.max(2*FLOOR_HALF[0]*Math.hypot(BASIS.a,BASIS.c),2*FLOOR_HALF[1]*Math.hypot(BASIS.b,BASIS.d));
export const PATROL_COUNT=4;
// Seeded random placement is repeatable on restart for visual/behavior comparisons.
const patrols=[];let patrolSeed=19820913;
const candidates=[...OPEN_CELLS];
while(patrols.length<PATROL_COUNT&&candidates.length){
 patrolSeed=(Math.imul(patrolSeed,1664525)+1013904223)>>>0;
 const [p]=candidates.splice(Math.floor(patrolSeed/4294967296*candidates.length),1);
 if(patrols.some(other=>Math.hypot(other.x-p.x,other.s-p.s)<150))continue;
 patrols.push({x:p.x,s:p.s});
}
export const RECOGNIZER_STARTS=[...OPENING_STARTS,...patrols];
