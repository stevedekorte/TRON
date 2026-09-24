import { GROUND_GRID_METERS, GROUND_GRID_LINE_HALF_WIDTH } from './ground-grid.js';
// Shared arena-local coordinates keep cycle turns on the visible grid.
export const ARENA_GRID=Object.freeze({
  cellMeters:GROUND_GRID_METERS/5*.9,
  lineHalfWidthMeters:GROUND_GRID_LINE_HALF_WIDTH/5*2,
});
