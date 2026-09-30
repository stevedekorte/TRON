// Explicit road-testing shortcut: ?cycleStart=1 bypasses the home menu.
export const CYCLE_TESTING = Object.freeze({ startInArena: false, startOutsideArena: true, outsideStartClearanceMeters: 20, endingsEnabled: false, startWithBreach: true, hideMiddleOpponent: true });
/** Arena-local meters; directions in X/Z, forward model axis -Z. */
export const LIGHT_CYCLES = Object.freeze({
  cellMeters: 4.8, halfCells: 86, speedMetersPerSecond: 38.4,
  lengthMeters: 3.6, trailHeightMeters: 1.5, startWallClearanceMeters: .5,
  trailHoldSeconds: 3, trailFlashSeconds: .24, trailLowerSeconds: .7,
  playerAttempts: 3,
  entranceFormationSpacingCells: 1,
  // Reach 95% of a requested speed change in about 1.5 seconds.
  slowSpeedMultiplier: .5, speedResponsePerSecond: 2, speedStepSeconds: 1 / 120,
  turboDurationSeconds: 5, turboRechargeSeconds: 60, turboSpeedMultiplier: 2.5,
  brakeDurationSeconds:5, brakeRechargeSeconds:60,
  aiTurboClearCells:28, aiBrakeClearCells:5, aiReserveStartCharge:.35,
  countdownSeconds: .3, roundSeconds: 120, restartSeconds: 6,
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

export const cycleFraction = (race, bike) => bike.escaped ? 1 : race.phase === "racing" && bike.alive
  ? (bike.progress ?? race.accumulator / (LIGHT_CYCLES.cellMeters / LIGHT_CYCLES.speedMetersPerSecond)) : 1;
