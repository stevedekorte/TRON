import {SPAWN,HALF} from '../levels/maze.js';

// Background transit in world meters. Source long axis is X; preserve its
// roughly 1,225-meter length. Simulation time makes pause/restart deterministic.
// Clu starts one maze width from its near edge; transit is three times that far ahead.
const transitDistance=6*HALF;
export const CARRIER={altitude:360,speed:24,
 startX:SPAWN.x-Math.sin(SPAWN.yaw)*transitDistance-Math.cos(SPAWN.yaw)*9000,
 s:SPAWN.s+Math.cos(SPAWN.yaw)*transitDistance-Math.sin(SPAWN.yaw)*9000};
