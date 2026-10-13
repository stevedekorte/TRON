/** Simulation recharge; the HUD animates from the recorded pre-award reserves. */
export function rewardCycleWallOwner(r, ownerId, victim) {
  const owner=r.cycles.find(b=>b.id===ownerId);
  if(!owner?.alive||owner===victim||owner.team===victim.team)return;
  owner.reserveReward={turboFrom:owner.turboCharge,brakeFrom:owner.brakeCharge??1};
  owner.turboCharge=1;
  owner.brakeCharge=1;
}
