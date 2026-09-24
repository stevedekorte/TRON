import {createOutlineMaze} from './outline-maze.js';
import {SHAPES,BLUEPRINT_SIZE,METERS_PER_PIXEL} from './labyrinth-outlines.js';
export const {WALL_HEIGHT,HALF,FLOOR_HALF,SIZE,CELL,BASIS,gridToWorld,worldToGrid,pixelToWorld,cellAt,cellCenter,WALLS,insideWall,nearbyWalls,wallAt,closestWallPoint,freePosition,GRID,solidCell,OPEN_CELLS,wallIntersection,lineOfSight}=createOutlineMaze({shapes:SHAPES,size:BLUEPRINT_SIZE,metersPerPixel:METERS_PER_PIXEL,gridSize:144});

// Measured center of the circular courtyard in the source blueprint, not image center.
export const BEAM_POSITION=pixelToWorld([724,514]);
export const PATROLS=Object.freeze({groundCount:8,airCount:6,innerRadiusFraction:.32,outerRadiusFraction:.78});
