import { selectCycleParticipant } from './jev-cycles.js';
import { worldFor } from '../levels/scenario.js';
import { hearingTarget } from '../simulation/hearing.js';
import { TACTICAL } from '../game/tactical.js';
import { configFor } from '../game/config.js';
import { applyTacticalChoice } from '../simulation/tactical.js';
// Gate on recorded knowledge, never on the player's hidden live position.
function withinJevRange(e, now) {
  const heard = hearingTarget(e, now),
    m =
      e.memory && now - e.memory.seenAt <= TACTICAL.jevMemoryMaxAgeSeconds
        ? e.memory
        : heard
          ? { ...heard.estimatedPosition, seenAt: heard.heardAt }
          : null;
  return (
    !!m &&
    !e.targetGone &&
    now - m.seenAt <= TACTICAL.jevMemoryMaxAgeSeconds &&
    Math.hypot(e.x - m.x, e.s - m.s) <= worldFor(e).MAZE_LENGTH * TACTICAL.jevRangeMazeLengths
  );
}

export function selectParticipant(run, autoplay, lastOwner) {
  const config = configFor(run);
  if(run.playerVehicle==='cycle'&&run.cycleRace&&!run.cycleRace.arenaPaused)
    return config.aiMode==='jev'?selectCycleParticipant(run):null;
  const e =
    config.aiMode === 'jev' &&
    [...run.recognizers, ...run.enemyTanks].find(
      (e) =>
        withinJevRange(e, run.time) &&
        e.health > 0 &&
        !e.teleport &&
        e.state !== 'materializing' &&
        !e.attack &&
        e.tactical?.options?.length &&
        e.tactical.requested !== e.tactical.revision &&
        run.time - e.tactical.started < TACTICAL.requestMaxAge,
    );
  const participantRevision = e?.teleportRevision;
  const playerRequest = autoplay?.request(run),
    player = !!playerRequest && (!e || lastOwner !== 'clu');
  if (!e && !player) return null;
  return {
    id: player ? 'clu' : e.id,
    owner: player ? 'clu' : 'enemy',
    plan: player ? playerRequest : e.tactical,
    teleportRevision: player ? run.teleportRevision : e.teleportRevision,
    current: () =>
      player
        ? autoplay.enabled
        : config.aiMode === 'jev' &&
          [...run.recognizers, ...run.enemyTanks].includes(e) &&
          e.teleportRevision === participantRevision,
    apply: (answer, revision, at) =>
      player
        ? autoplay.apply(answer, revision, at, run)
        : withinJevRange(e, run.time) && applyTacticalChoice(e, answer, revision, at, run.time),
  };
}
