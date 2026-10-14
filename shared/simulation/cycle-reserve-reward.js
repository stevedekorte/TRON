/** Apply the wall owner's opposing-team reward or allied-team penalty. */
export function rewardCycleWallOwner(r, ownerId, victim) {
  const owner=r.cycles.find(b=>b.id===ownerId);
  if(!owner||owner===victim)return;
  // Keep a round-local record even when a surviving wall belongs to a dead
  // cycle. Credit each enemy once; friendly crashes are never roster awards.
  if(owner.team!==victim.team){
    owner.wallEliminations??=[];
    if(!owner.wallEliminations.some(hit=>hit.id===victim.id))owner.wallEliminations.push({id:victim.id,team:victim.team});
  }
  if(!owner.alive)return;
  const target=owner.team===victim.team?0:1;
  owner.reserveReward={revision:(owner.reserveReward?.revision??0)+1,turboFrom:owner.turboCharge,brakeFrom:owner.brakeCharge??1,target};
  owner.turboCharge=target;
  owner.brakeCharge=target;
}
