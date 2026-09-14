// Roles are re-evaluated from local neighbors and the observer's own sighting.
// No fixed squad membership and no access to unseen live tank coordinates.
export const SUPPORT={neighborRange:180,laneSpacing:130,trailingDistance:35};
export function formationTarget(e,others,goal,radioRange,settings=SUPPORT){
 if(!e.memory||e.targetGone)return null;
 const range=Math.min(settings.neighborRange,radioRange);
 const peers=others.filter(o=>o.memory&&!o.targetGone&&o.state!=='destroyed'&&
  Math.hypot(o.x-e.x,o.s-e.s,o.y-e.y)<=range);
 if(peers.length<2)return null;
 const distance=o=>Math.hypot(o.x-e.memory.x,o.s-e.memory.s);
 const leader=peers.reduce((lead,o)=>distance(o)<distance(lead)-.1||Math.abs(distance(o)-distance(lead))<=.1&&o.id<lead.id?o:lead);
 if(leader===e)return null;
 const heading=Math.hypot(e.memory.vx,e.memory.vs)>2?-Math.atan2(e.memory.vx,e.memory.vs):leader.yaw;
 const right={x:Math.cos(heading),s:Math.sin(heading)},forward={x:-Math.sin(heading),s:Math.cos(heading)};
 const side=o=>{const lateral=(o.x-leader.x)*right.x+(o.s-leader.s)*right.s;return Math.abs(lateral)>1?Math.sign(lateral):(o.id<leader.id?-1:1);};
 const flank=side(e),onFlank=peers.filter(o=>o!==leader&&side(o)===flank).sort((a,b)=>a.id-b.id);
 const offset=flank*settings.laneSpacing*(1+onFlank.indexOf(e));
 const ahead=(e.x-leader.x)*forward.x+(e.s-leader.s)*forward.s;
 return {x:goal.x+right.x*offset-forward.x*settings.trailingDistance,
  s:goal.s+right.s*offset-forward.s*settings.trailingDistance,
  speedScale:Math.max(.45,Math.min(1.08,1-ahead*.012)),leader:leader.id};
}
