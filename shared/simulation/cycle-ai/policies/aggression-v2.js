// Evolved with obstacle-aware approach and early confirmed-offense rewards.
// Selected after two fresh-seed comparisons and rendered performance checks.
// Prior policy remains in aggression-v1.js for rollback. Training never auto-promotes.
export const PLAYTESTED_POLICY=Object.freeze({
  "version": 1,
  "id": "approach-340000-0-0",
  "space": 0.7,
  "clearance": 0.5710767524503172,
  "cutoff": 1.6172238771803673,
  "pressure": 0.3472025061398745,
  "allyPenalty": 1.027476475341245,
  "reserveCost": 0.08986003088857979,
  "reserveFloor": 0.18521312844008211,
  "straightBonus": 0.09796467728912829,
  "switchCost": 0.06432283084141091,
  "leadSeconds": 0.15562226661108436,
  "variation": 0.010922345181461424
});
