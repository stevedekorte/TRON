import {ProjectedFloorShadows,FLOOR_WALL_SHADOWS} from './projected-floor-shadows.js';
export const CYCLE_TRAIL_SHADOWS=FLOOR_WALL_SHADOWS;
// Trails only receive their authored color; their exact projected silhouettes
// darken the floor without a dynamic atlas or trail-to-trail shadow reception.
export class CycleTrailShadows extends ProjectedFloorShadows {
 constructor(root,trails,floors){super(root,trails,floors,{tapered:true});}
}
