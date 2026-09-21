import {GROUND_GRID_METERS} from './ground-grid.js';
import {MAZE_INSTANCES} from './maze.js';

// Exactly two floor-grid cells per side; preserve exterior clearance when snapping.
export const TELEPORTERS=Object.freeze({size:2*GROUND_GRID_METERS,wallClearance:45});
export function createTeleportPads(sites=MAZE_INSTANCES){
 return sites.flatMap((m,index)=>{
  const b=m.bounds,cx=(b.minX+b.maxX)/2,cs=(b.minS+b.maxS)/2,d=TELEPORTERS.wallClearance+TELEPORTERS.size/2;
  return [[b.minX-d,cs],[cx,b.maxS+d],[b.maxX+d,cs],[cx,b.minS-d]].map(([x,s],side)=>({
   id:`${m.id}:${side}`,mazeId:m.id,
   x:(side===0?Math.floor(x/GROUND_GRID_METERS):side===2?Math.ceil(x/GROUND_GRID_METERS):Math.round(x/GROUND_GRID_METERS))*GROUND_GRID_METERS,
   s:(side===3?Math.floor(s/GROUND_GRID_METERS):side===1?Math.ceil(s/GROUND_GRID_METERS):Math.round(s/GROUND_GRID_METERS))*GROUND_GRID_METERS,
   size:TELEPORTERS.size,
   destination:`${sites[(index+1+side%Math.max(1,sites.length-1))%sites.length].id}:${side}`
  }));
 });
}
export const TELEPORT_PADS=createTeleportPads();
