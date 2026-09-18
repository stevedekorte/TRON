// Local exploration memory, independent of any hidden player coordinates.
export function patrolChoices(unit,cells,random,now,maxDistance=350){
 unit.patrolVisits=(unit.patrolVisits||[]).filter(p=>now-p.time<180);
 unit.patrolVisits.push({x:unit.x,s:unit.s,time:now});
 unit.patrolVisits=unit.patrolVisits.slice(-16);
 const nearby=cells.filter(p=>{const d=Math.hypot(p.x-unit.x,p.s-unit.s);return d>30&&d<maxDistance;});
 const pool=nearby.length?nearby:cells;
 return pool.map(p=>{
  const freshness=Math.min(180,...unit.patrolVisits.map(v=>Math.hypot(p.x-v.x,p.s-v.s)));
  return {p,score:freshness+random()*90-Math.hypot(p.x-unit.x,p.s-unit.s)*.12};
 }).sort((a,b)=>b.score-a.score).slice(0,12).map(item=>item.p);
}
