// Seconds and world meters; one sweep travels from nose (-Z) to tail (+Z).
export const MATERIALIZATION=Object.freeze({openSeconds:.6,passSeconds:1.8,fadeSeconds:.35,sweepClearance:6,lineHeight:.2});
export const materializationDuration=(timing=MATERIALIZATION)=>timing.openSeconds+timing.passSeconds+timing.fadeSeconds;
export function materializationPhase(age,timing=MATERIALIZATION){
 const {openSeconds:open,passSeconds:p,fadeSeconds:fade}=timing;
 const clamp=v=>Math.max(0,Math.min(1,v));
 const expansion=clamp(age/open),height=expansion*expansion*(3-2*expansion);
 const wire=clamp((age-open)/p),blend=clamp((age-open-p)/fade),solid=blend*blend*(3-2*blend);
 return {wire,solid,scan:wire,height,opacity:1-solid,complete:age>=materializationDuration(timing)};
}
