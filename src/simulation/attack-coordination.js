import {AIR_HULL} from './maneuver-geometry.js';
import {worldFor} from '../levels/scenario.js';
import {connectedSearchRoutes} from './search-routes.js';
import { radioRangeFor } from '../game/communication.js';
import { TACTICAL } from '../game/tactical.js';
export const ATTACK_COORDINATION = Object.freeze({
  leaseSeconds: 12,
  progressMeters: 5,
  targetAgreementMeters: 100,
  supportMeters: 90,
  approachMeters: 140,
  supportSpacingMeters: 60,
  supportDirections: 8,
  routeNodes: 400,
  targetShiftMeters: 45,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.s - b.s, (a.y || 0) - (b.y || 0));
// Coordinate only observers with recorded target knowledge and radio contact.
export function coordinateAttacks(units, now) {
  const aircraft = units.filter(
    (e) =>
      e.kind !== 'ground' &&
      e.health > 0 &&
      !e.teleport &&
      !e.targetGone &&
      e.memory &&
      now - e.memory.seenAt < 38 &&
      (e.attack || e.attackAssignment ||
        Math.hypot(e.x - e.memory.x, e.s - e.memory.s) < ATTACK_COORDINATION.approachMeters),
  );
  for (const e of units) if (!aircraft.includes(e)) e.attackAssignment = null;
  const assigned = new Set();
  for (const anchor of [...aircraft].sort((a, b) => a.id - b.id)) {
    if (assigned.has(anchor)) continue;
    const peers = aircraft.filter(
      (e) =>
        !assigned.has(e) &&
        distance(anchor, e) <= radioRangeFor(anchor) &&
        Math.hypot(e.memory.x - anchor.memory.x, e.memory.s - anchor.memory.s) <=
          ATTACK_COORDINATION.targetAgreementMeters,
    );
    const eligible = peers.filter(
      (e) =>
        e.attack ||
        (e.canSee &&
          e.health > TACTICAL.retreatHealth &&
          now >= (e.nextAttack || 0) &&
          !e.stompDisabled &&
          !e.tactical?.blocked),
    );
    const previous = peers
      .map((e) => e.attackAssignment)
      .filter((a) => a && a.until > now)
      .sort((a, b) => a.since - b.since || a.leaderId - b.leaderId)[0];
    const old =
      previous && eligible.find((e) => e.id === previous.leaderId && !e.tactical?.blocked);
    const attacking = eligible.find((e) => e.attack);
    const expiredLeader = peers.find((e) => e.attackAssignment?.until <= now)?.attackAssignment
      ?.leaderId;
    const candidates = eligible.filter((e) => eligible.length === 1 || e.id !== expiredLeader);
    const leader =
      attacking ||
      old ||
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x - anchor.memory.x, a.s - anchor.memory.s) -
            Math.hypot(b.x - anchor.memory.x, b.s - anchor.memory.s) || a.id - b.id,
      )[0];
    const same = leader && previous?.leaderId === leader.id;
    const heading = same ? previous.heading : leader?.yaw || 0;
    const approachDistance=leader?Math.hypot(leader.x-anchor.memory.x,leader.s-anchor.memory.s)+Math.max(0,leader.y-AIR_HULL.bottom):Infinity;
    const progressed=same&&approachDistance<previous.progressDistance-ATTACK_COORDINATION.progressMeters;
    const progressDistance=same&&!progressed?previous.progressDistance:approachDistance;
    const supporters=peers.filter(e=>e!==leader).sort((a,b)=>a.id-b.id);
    const membership=supporters.map(e=>e.id).join(',');
    const reuse=same&&previous.membership===membership&&previous.origin&&Math.hypot(previous.origin.x-anchor.memory.x,previous.origin.s-anchor.memory.s)<ATTACK_COORDINATION.targetShiftMeters;
    const goals=reuse?previous.goals:leader?supportGoals(anchor, supporters, heading):null;
    const origin=reuse?previous.origin:{x:anchor.memory.x,s:anchor.memory.s};
    for (const [i, e] of peers.entries()) {
      assigned.add(e);
      const next = leader
        ? {
            leaderId: leader.id,
            since: same ? previous.since : now,
            until: same&&!progressed ? previous.until : now + ATTACK_COORDINATION.leaseSeconds,
            progressDistance,
            heading,
            slot: i,
            membership,origin,goals,role:e===leader?'lead':supporters[0]===e?'spotter':'cutoff',
          }
        : null;
      if ((e.attackAssignment?.leaderId !== next?.leaderId || e.id !== next?.leaderId && e.attackAssignment?.goals !== next?.goals) && e.tactical) {
        e.tactical.plan = null;
        e.tactical.nextPlan = 0;
        e.tactical.revision++;
      }
      e.attackAssignment = next;
    }
  }
}
export function supportingAttack(e) {
  return e.attackAssignment && e.attackAssignment.leaderId !== e.id;
}
export function attackSupportGoal(e, target) {
  const assigned=e.attackAssignment?.goals?.[e.id];
  if(assigned)return {...assigned};
  const a = e.attackAssignment,
    side = a.slot % 2 ? 1 : -1,
    offset = ATTACK_COORDINATION.supportMeters * (1 + Math.floor(a.slot / 2));
  return {
    x: target.x + Math.cos(a.heading) * side * offset,
    s: target.s + Math.sin(a.heading) * side * offset,
  };
}

// Ground-connected branches are plausible exits, not knowledge of hidden Clu.
// Compute once per formation/contact shift, not once per unit per simulation tick.
function supportGoals(anchor, supporters, heading){
 const target=anchor.memory,world=worldFor(anchor),goals={},used=[];
 if(!supporters.length)return goals;
 const routes=connectedSearchRoutes(target,{world,limit:ATTACK_COORDINATION.routeNodes})
  .filter(p=>Math.hypot(p.x-target.x,p.s-target.s)>=ATTACK_COORDINATION.supportMeters);
 const altitude=world.WALL_HEIGHT+AIR_HULL.bottom+8;
 for(const [index,e] of supporters.entries()){
  const angle=heading+index*Math.PI*2/Math.max(ATTACK_COORDINATION.supportDirections,supporters.length);
  const radius=ATTACK_COORDINATION.supportMeters*(1+Math.floor(index/ATTACK_COORDINATION.supportDirections));
  const fallback={x:target.x+Math.cos(angle)*radius,s:target.s+Math.sin(angle)*radius};
  const candidates=routes.filter(p=>used.every(u=>Math.hypot(p.x-u.x,p.s-u.s)>=ATTACK_COORDINATION.supportSpacingMeters));
  candidates.sort((a,b)=>Math.hypot(a.x-fallback.x,a.s-fallback.s)-Math.hypot(b.x-fallback.x,b.s-fallback.s));
  const selected=index===0?candidates.find(p=>world.lineOfSight({...p,y:altitude},{...target,y:2.8})):candidates[0];
  // No connected exit available: maintain a distinct overhead observation slot.
  let point=selected||fallback;
  for(let attempt=0;used.some(u=>Math.hypot(point.x-u.x,point.s-u.s)<ATTACK_COORDINATION.supportSpacingMeters)&&attempt<16;attempt++){
   const a=angle+(attempt+1)*Math.PI/4,r=radius+Math.floor(attempt/8)*ATTACK_COORDINATION.supportMeters;
   point={x:target.x+Math.cos(a)*r,s:target.s+Math.sin(a)*r};
  }
  goals[e.id]={x:point.x,s:point.s};used.push(point);
 }
 return goals;
}
