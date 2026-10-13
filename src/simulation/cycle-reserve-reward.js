/** Apply the wall owner's opposing-team reward or allied-team penalty. */
export function rewardCycleWallOwner(r, ownerId, victim) {
  const owner=r.cycles.find(b=>b.id===ownerId);
  if(!owner?.alive||owner===victim)return;
  const target=owner.team===victim.team?0:1;
  owner.reserveReward={turboFrom:owner.turboCharge,brakeFrom:owner.brakeCharge??1,target};
  owner.turboCharge=target;
  owner.brakeCharge=target;
}
