import { worldFor } from '../levels/scenario.js';
// Radius, in multiples of one maze's longest world-space dimension.
export const COMMUNICATION = Object.freeze({ radiusMazeWidths: .25 });
export const radioRangeFor = (unit) => worldFor(unit).MAZE_LENGTH * COMMUNICATION.radiusMazeWidths;
