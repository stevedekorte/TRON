import {defaults} from './config.js';
import {SPAWN,HALF} from '../levels/maze.js';

// Background transit in world meters. Source long axis is X; preserve its
// roughly 1,225-meter length. Simulation time makes pause/restart deterministic.
// Clu starts one maze width from its near edge; transit is 1.5 times that far ahead.
const transitDistance=3*HALF,lateralOffset=3000;
export const CARRIER={altitude:360,speed:defaults.maxSpeed,
 startX:SPAWN.x-Math.sin(SPAWN.yaw)*transitDistance-Math.cos(SPAWN.yaw)*lateralOffset,
 s:SPAWN.s+Math.cos(SPAWN.yaw)*transitDistance-Math.sin(SPAWN.yaw)*lateralOffset};

export const AIR_ESCORT_COUNT=2;
export function airEscortSlot(index,time){return {x:CARRIER.startX+CARRIER.speed*time+120,s:CARRIER.s+(index?180:-180)};}
