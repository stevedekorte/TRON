/** Arena-local meters; directions in X/Z, forward model axis -Z. */
export const LIGHT_CYCLES = Object.freeze({
  cellMeters: 4.8, halfCells: 86, speedMetersPerSecond: 38.4,
  lengthMeters: 3.6, trailHeightMeters: 1.5,
  trailHoldSeconds: 3, trailFlashSeconds: .24, trailLowerSeconds: .7,
  countdownSeconds: 3, roundSeconds: 120, restartSeconds: 6,
  lookAheadCells: 45, floodCells: 360,
  colors: [0xffc52e, 0x48baff],
});
export const CYCLE_DIRECTIONS = Object.freeze([[0,-1],[1,0],[0,1],[-1,0]]);

/** Shared timing keeps the visible barrier and its collision lifetime consistent. */
export function cycleTrailState(age) {
  const flashAge=age-LIGHT_CYCLES.trailHoldSeconds;
  if(flashAge<0)return {height:1,flash:0};
  if(flashAge<LIGHT_CYCLES.trailFlashSeconds)return {height:1,flash:Math.sin(Math.PI*flashAge/LIGHT_CYCLES.trailFlashSeconds)};
  const t=Math.min(1,(flashAge-LIGHT_CYCLES.trailFlashSeconds)/LIGHT_CYCLES.trailLowerSeconds);
  return {height:1-t,flash:0};
}
