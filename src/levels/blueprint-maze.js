import {createOutlineMaze} from './outline-maze.js';
import {OUTLINES,BLUEPRINT_SIZE,METERS_PER_PIXEL} from './blueprint-outlines.js';
export const {WALL_HEIGHT,HALF,FLOOR_HALF,SIZE,CELL,BASIS,gridToWorld,worldToGrid,pixelToWorld,cellAt,cellCenter,WALLS,insideWall,nearbyWalls,wallAt,closestWallPoint,freePosition,GRID,solidCell,OPEN_CELLS,wallIntersection,lineOfSight}=createOutlineMaze({shapes:OUTLINES.map(outline=>({outline})),size:BLUEPRINT_SIZE,metersPerPixel:METERS_PER_PIXEL});
export const SPAWN={x:pixelToWorld([1288,980]).x,s:-FLOOR_HALF[1]-2*HALF,yaw:0};
export const RECOGNIZER_STARTS=[[-80,150],[1752,230],[-80,800],[1752,850],[830,-90]].map(pixelToWorld);
