import {spotlightStrength} from './spotlight.js';
// Alert is independent of the current navigation state. Reports retain their
// original sighting time, so radio relays cannot perpetually renew alertness.
export const ALERT=Object.freeze({duration:180,positionFreshness:1.5,fadeSeconds:30});
export function raiseAlert(e,seenAt){e.alertUntil=Math.max(e.alertUntil||0,seenAt+ALERT.duration);}
export function searchlightStrength(e,now){
 if(e.targetGone||e.state==='destroyed')return 0;
 if(e.spotlight)return spotlightStrength(e,now);
 if(e.canSee||!['wander','search','investigate'].includes(e.state))return 0;
 if(e.memory&&now-e.memory.seenAt<=ALERT.positionFreshness)return 0;
 return Math.max(0,Math.min(1,((e.alertUntil||0)-now)/ALERT.fadeSeconds));
}
