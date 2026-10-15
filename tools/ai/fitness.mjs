// Offline evaluation only: never adds work to a live simulation tick.
export const AI_FITNESS=Object.freeze({winPoints:1,fastWinBonusPoints:.5,enemyWallPoints:.5,trapAssistPoints:.35,confinementPoints:.1});
export function fastWinBonus(result,team,weights=AI_FITNESS){
 // Missing legacy timing earns no bonus; only a confirmed winner qualifies.
 if(team==null||result.winner!==team||!Number.isFinite(result.seconds)||result.seconds<0||!Number.isFinite(result.matchLimitSeconds)||result.matchLimitSeconds<=0)return 0;
 return weights.fastWinBonusPoints*Math.max(0,1-result.seconds/result.matchLimitSeconds);
}
export function wallEliminationsByTeam(race){
 const victims=new Set(),counts=Array(race.teamCount).fill(0);
 for(const owner of race.cycles)for(const hit of owner.wallEliminations??[]){
  const victim=race.cycles.find(b=>b.id===hit.id);
  if(!victim||victim.id===owner.id||victim.team===owner.team||victims.has(victim.id))continue;
  victims.add(victim.id);counts[owner.team]++;
 }
 return counts;
}
export function trapRewardsByTeam(race){
 const assists=Array(race.teamCount).fill(0),confinements=Array(race.teamCount).fill(0);
 for(const field of ['trapAssists','trapsCreated']){
  const victims=new Map();
  for(const owner of race.cycles)for(const hit of owner[field]??[]){
   const victim=race.cycles.find(b=>b.id===hit.id);if(!victim||victim.team===owner.team)continue;
   if(!victims.has(hit.id))victims.set(hit.id,new Set());victims.get(hit.id).add(owner);
  }
  for(const owners of victims.values())for(const owner of owners)(field==='trapAssists'?assists:confinements)[owner.team]+=1/owners.size;
 }
 return {trapAssists:assists,confinements};
}
export function matchFitness(result,team,weights=AI_FITNESS){
 return (result.winner===team?weights.winPoints:0)+fastWinBonus(result,team,weights)+(result.wallEliminations?.[team]??0)*weights.enemyWallPoints+(result.trapAssists?.[team]??0)*weights.trapAssistPoints+(result.confinements?.[team]??0)*weights.confinementPoints;
}
// Runtime is the hard gate; successful aggression and wins jointly rank policies.
export function compareFitness(a,b){
 return Number(b.passesTiming)-Number(a.passesTiming)||b.fitness-a.fitness||b.winRate-a.winRate;
}
