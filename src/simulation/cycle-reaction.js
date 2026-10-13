import {LIGHT_CYCLES as C} from '../game/light-cycles.js';

export function cycleReactionProfile(bike){
 return bike.reactionTiming??{meanSeconds:C.teamReactionSeconds[bike.team]??C.aiReactionSeconds,
  standardDeviationSeconds:C.aiReactionStandardDeviationSeconds,
  minSeconds:C.aiReactionMinSeconds,maxSeconds:C.aiReactionMaxSeconds};
}
// Truncated Gaussian: reject tails rather than piling them up at the bounds.
export function sampleCycleReaction(bike,random){
 const p=cycleReactionProfile(bike);
 for(let attempt=0;attempt<32;attempt++){
  const normal=Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,random())))*Math.cos(2*Math.PI*random());
  const seconds=p.meanSeconds+normal*p.standardDeviationSeconds;
  if(seconds>=p.minSeconds&&seconds<=p.maxSeconds)return seconds;
 }
 return Math.max(p.minSeconds,Math.min(p.maxSeconds,p.meanSeconds));
}
