import { radioRangeFor } from '../game/communication.js';
import { TACTICAL } from '../game/tactical.js';
export const ATTACK_COORDINATION = Object.freeze({
  leaseSeconds: 12,
  targetAgreementMeters: 100,
  supportMeters: 90,
  approachMeters: 140,
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
      (e.attack ||
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
    for (const [i, e] of peers.entries()) {
      assigned.add(e);
      const next = leader
        ? {
            leaderId: leader.id,
            since: same ? previous.since : now,
            until: same ? previous.until : now + ATTACK_COORDINATION.leaseSeconds,
            heading,
            slot: i,
          }
        : null;
      if (e.attackAssignment?.leaderId !== next?.leaderId && e.tactical) {
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
  const a = e.attackAssignment,
    side = a.slot % 2 ? 1 : -1,
    offset = ATTACK_COORDINATION.supportMeters * (1 + Math.floor(a.slot / 2));
  return {
    x: target.x + Math.cos(a.heading) * side * offset,
    s: target.s + Math.sin(a.heading) * side * offset,
  };
}
