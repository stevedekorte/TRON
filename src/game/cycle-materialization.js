// Fractions of the existing formation interval; no change to launch timing.
export const CYCLE_REZ_STAGES=Object.freeze({contourEnd:.38,gridStart:.34,gridEnd:.64,bodyStart:.62,bodyEnd:.86,glowStart:.63,glowPeak:.79,settleStart:.82});
const smooth=(start,end,p)=>{const t=Math.max(0,Math.min(1,(p-start)/(end-start)));return t*t*(3-2*t);};
export function cycleMaterializationPhase(progress){
 const c=CYCLE_REZ_STAGES;
 return {contours:smooth(0,c.contourEnd,progress),grid:smooth(c.gridStart,c.gridEnd,progress),solid:smooth(c.bodyStart,c.bodyEnd,progress),glow:smooth(c.glowStart,c.glowPeak,progress)*(1-smooth(c.settleStart,1,progress))};
}
