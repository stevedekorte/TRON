import { GROUND_GRID_METERS, GROUND_GRID_LINE_HALF_WIDTH } from './ground-grid.js';
// Visual grid density; cycle movement is continuous, independent of these cells.
export const ARENA_GRID=Object.freeze({
  cellMeters:GROUND_GRID_METERS/5*.9,
  lineHalfWidthMeters:GROUND_GRID_LINE_HALF_WIDTH/5*2,
});
// An even number of cells keeps a line at the center and both inner walls.
export function fitArenaGridSpacing(innerHalfExtentMeters,preferredCellMeters=ARENA_GRID.cellMeters){
  const halfCells=Math.max(1,Math.round(innerHalfExtentMeters/preferredCellMeters));
  return innerHalfExtentMeters/halfCells;
}
