import {LIGHT_CYCLES as C} from '../config/light-cycles.js';
// Fixed fairness limits, not evolvable weights. At constant speed only 35% of
// samples fall below one cycle length; the time floor and tick rounding can
// only reduce that fraction. Sample once per new turn intention.
export const AI_TURN_REACTION=Object.freeze({minimumSeconds:.08,minCycleLengths:.65,maxCycleLengths:1.65});
export function sampleTurnReactionSeconds(bike,random){
 const p=AI_TURN_REACTION;
 const lengthSeconds=C.lengthMeters/Math.max(1,C.speedMetersPerSecond*(bike.speedMultiplier??1));
 return Math.max(p.minimumSeconds,lengthSeconds*p.minCycleLengths)+lengthSeconds*(p.maxCycleLengths-p.minCycleLengths)*random();
}
