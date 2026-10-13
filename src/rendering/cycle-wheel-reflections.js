// Small, local film-style spoke glints. Normal travel alternates at 24 states
// per second (12 flashes); slow travel and turbo scale the cadence in seconds.
export const CYCLE_WHEEL_REFLECTIONS=Object.freeze({referenceSpeedMetersPerSecond:38.4,normalFlashesPerSecond:12,maxFlashesPerSecond:24,fadeInSpeedMetersPerSecond:2,innerRadiusMeters:.14,outerRadiusMeters:.38,halfWidthRadians:.065,intensity:.9});
export function advanceWheelReflection(state,time,speed){
 const dt=state?Math.max(0,time-state.time):0;
 const rate=Math.min(CYCLE_WHEEL_REFLECTIONS.maxFlashesPerSecond,Math.abs(speed)/CYCLE_WHEEL_REFLECTIONS.referenceSpeedMetersPerSecond*CYCLE_WHEEL_REFLECTIONS.normalFlashesPerSecond);
 return {time,phase:((state?.phase??0)+dt*rate)%1024,strength:Math.min(1,Math.abs(speed)/CYCLE_WHEEL_REFLECTIONS.fadeInSpeedMetersPerSecond)};
}
