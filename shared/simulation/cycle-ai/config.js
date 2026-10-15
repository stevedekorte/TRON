import {PLAYTESTED_POLICY} from './policies/aggression-v1.js';
import {validateNetwork} from './network.js';
// Runtime/safety limits are not evolved. Distances below are arena-cell units
// only at the geometry adapter; behavior time and distance parameters use SI.
export const AI_LIMITS=Object.freeze({version:1,tickHz:120,planTicks:12,maxPlansPerTick:2,turnTicks:6,
 maxTrails:2048,maxLinks:32768,bucketCells:8,segmentTestsPerQuery:192,segmentTestsPerTick:12000,
 maxCandidates:9,guardSeconds:.14,safetySeconds:.08,horizonSeconds:1.2,maxRayCells:45,
 spaceVisits:256,nearBestTolerance:.025});
export const BASELINE_POLICY=Object.freeze({version:1,id:'bounded-v1',space:1.4,clearance:.7,cutoff:2.4,
 pressure:.55,allyPenalty:1.4,reserveCost:.22,reserveFloor:.2,straightBonus:.12,switchCost:.12,
 leadSeconds:.18,variation:.015});
export const DEFAULT_POLICY=PLAYTESTED_POLICY;
export const POLICY_BOUNDS=Object.freeze({space:[.7,2.5],clearance:[.3,1.4],cutoff:[1,4],pressure:[.1,1],
 allyPenalty:[1,2.5],reserveCost:[.08,.6],reserveFloor:[.1,.5],straightBonus:[.05,.25],switchCost:[.05,.3],leadSeconds:[.12,.35],variation:[0,.025]});
export function validatePolicy(policy){
 if(!policy||policy.version!==1)throw new Error('Unsupported cycle AI policy');
 const result={...DEFAULT_POLICY};
 for(const [key,[min,max]] of Object.entries(POLICY_BOUNDS)){
  const value=policy[key]??result[key];if(!Number.isFinite(value)||value<min||value>max)throw new Error(`Invalid cycle AI parameter: ${key}`);result[key]=value;
 }
 if(policy.network)result.network=validateNetwork(policy.network);
 result.id=String(policy.id??'custom').slice(0,80);return Object.freeze(result);
}
