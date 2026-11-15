import {LIGHT_CYCLES} from '../../shared/simulation/config/light-cycles.js';
import {ROAD_CYCLE} from '../../shared/simulation/config/cycle-road.js';

/**
 * Where a cycle's actual speed sits between its current minimum and maximum,
 * for the camera's field of view: -1 at the minimum (full brake), 0 at cruise,
 * 1 at the maximum (full turbo), linear on each side of cruise.
 * In the arena, the minimum and maximum scale with the grid speed (arena speed):
 * minimum = grid speed × slowSpeedMultiplier, maximum = grid speed ×
 * turboSpeedMultiplier, so a rising grid speed does not by itself move it.
 * On the road, the range is cruise to turbo speed limit; below cruise is 0
 * (road cycles slow to a stop, which is not a brake).
 */
export function cycleSpeedFovPosition(bike,roadConfig){
  if(!bike)return 0;
  const clamp01=x=>Math.min(1,Math.max(0,x));
  if(bike.escaped){
    const c=roadConfig??ROAD_CYCLE,cruise=c.maxSpeedMetersPerSecond,max=c.turboMaxSpeedMetersPerSecond;
    const speed=Math.abs(bike.roadSpeed??cruise);
    return max>cruise?clamp01((speed-cruise)/(max-cruise)):0;
  }
  const C=LIGHT_CYCLES,ratio=(bike.speedMultiplier??1)/(bike.gridSpeedMultiplier??1);
  return ratio>=1?clamp01((ratio-1)/(C.turboSpeedMultiplier-1)):-clamp01((1-ratio)/(1-C.slowSpeedMultiplier));
}
