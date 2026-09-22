import { visibleDebris, DEBRIS_AVOIDANCE } from './debris-avoidance.js';
import { configFor } from '../game/config.js';
import { worldFor } from '../levels/scenario.js';
import { AUTOPLAY } from '../game/autoplay.js';
import { config, TURBO, angleDelta } from '../game/config.js';
import { visibleAutoplayEnemies, autoplayThreats } from './autoplay-perception.js';
import { autoplayRoute } from './autoplay-route.js';
import { groundRoute } from './ground-tanks.js';
import { DATA_BEAM } from './data-beams.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.s - b.s);
/** Mission memory and candidate generation; never owns the execution cursor. */
export class AutoplayMission {
  constructor() {
    this.reset();
  }
  reset() {
    this.visited = [];
    this.contacts = [];
    this.objectiveId = null;
    this.objectiveRoute = null;
    this.objectiveFailures = new Map();
  }
  invalidateRoute() {
    this.objectiveFailures.clear();
    this.objectiveRoute = null;
  }
  plan(run, previousPlan, revision) {
    const config = configFor(run);
    const { OPEN_CELLS, nearbyWalls } = worldFor(run),
      clear = (a, b) =>
        worldFor(run).wallIntersection({ ...a, y: 2 }, { ...b, y: 2 }, config.tankRadius + 0.5) ===
        null;
    this.contacts = visibleAutoplayEnemies(run);
    this.visited.push({ x: run.x, s: run.s });
    this.visited = this.visited.slice(-AUTOPLAY.historySize);
    const threats = autoplayThreats(run, this.contacts);
    const options = [],
      closest = threats.slice().sort((a, b) => distance(a, run) - distance(b, run))[0];
    const tracked = threats.find((e) => e.id === previousPlan?.targetId);
    const nearest =
      tracked &&
      closest &&
      distance(tracked, run) <= distance(closest, run) * AUTOPLAY.targetSwitchRatio
        ? tracked
        : closest;
    const add = (kind, goal, route, score) => {
      if (!route.length) return;
      options.push({
        id: `m${options.length}`,
        kind,
        goal,
        route,
        localScore: score,
        targetId: nearest?.id,
      });
    };
    // Short swept corridors offer evasion and exploration without routing through slabs.
    for (let i = 0; i < 8; i++) {
      const yaw = run.yaw + (i * Math.PI) / 4;
      for (const length of [AUTOPLAY.stepMeters, 16]) {
        const p = { x: run.x - Math.sin(yaw) * length, s: run.s + Math.cos(yaw) * length };
        if (!clear(run, p)) continue;
        const revisited = this.visited.filter((v) => distance(v, p) < 18).length;
        const escape = nearest ? distance(p, nearest) - distance(run, nearest) : 0;
        add(
          nearest ? 'evade-and-engage' : 'explore',
          p,
          [p],
          30 +
            escape * (run.health <= 1 ? 2 : 1) -
            revisited * 8 -
            Math.abs(angleDelta(run.yaw, yaw)) * 3,
        );
        break;
      }
    }
    // Static destinations are known map features; only visible enemies enter the snapshot.
    const remaining = run.dataBeams.filter((b) => b.collectedAt === null);
    const nearby = remaining.filter((b) => distance(b, run) < AUTOPLAY.nearbyObjectiveMeters);
    const beams = (nearby.length ? nearby : remaining)
      .slice()
      .sort(
        (a, b) =>
          Number(b.id === this.objectiveId) - Number(a.id === this.objectiveId) ||
          distance(a, run) - distance(b, run),
      );
    let beam = null;
    for (const candidate of beams) {
      if ((this.objectiveFailures.get(candidate.id) ?? -Infinity) > run.time) continue;
      const goal = { x: candidate.x, s: candidate.s };
      let route = [];
      if (candidate.id === this.objectiveId && this.objectiveRoute) {
        for (let i = this.objectiveRoute.length - 1; i >= 0; i--)
          if (clear(run, this.objectiveRoute[i])) {
            route = this.objectiveRoute.slice(i);
            break;
          }
      }
      if (!route.length) route = autoplayRoute(run, goal);
      if (!route.length || distance(route.at(-1), goal) > DATA_BEAM.radius) {
        this.objectiveFailures.set(candidate.id, run.time + AUTOPLAY.objectiveRetrySeconds);
        continue;
      }
      beam = candidate;
      this.objectiveId = beam.id;
      this.objectiveRoute = route;
      add('collect-data', goal, route, nearest && distance(run, nearest) < 80 ? 10 : 65);
      break;
    }
    if (!beam) {
      this.objectiveId = null;
      const goal = OPEN_CELLS.filter((p) => distance(p, run) > 25 && distance(p, run) < 180).sort(
        (a, b) =>
          distance(a, run) -
          distance(b, run) +
          this.visited.filter((v) => distance(v, a) < 30).length * 50 -
          this.visited.filter((v) => distance(v, b) < 30).length * 50,
      )[0];
      if (goal) add('enter-maze', { x: goal.x, s: goal.s }, groundRoute(run, goal), 45);
    }
    add('hold', { x: run.x, s: run.s }, [{ x: run.x, s: run.s }], run.transferActive ? 100 : -20);
    // Without visible threats, keep the mission route instead of offering aimless
    // wandering as an equally valid Jev choice. Combat retains maneuver freedom.
    if (run.transferActive || (!nearest && remaining.length)) {
      const kind = run.transferActive
        ? 'hold'
        : beam
          ? 'collect-data'
          : options.some((o) => o.kind === 'enter-maze')
            ? 'enter-maze'
            : 'hold';
      for (let i = options.length - 1; i >= 0; i--)
        if (options[i].kind !== kind) options.splice(i, 1);
    }
    const plan = options.reduce(
      (best, o) => (o.localScore > best.localScore ? o : best),
      options[0],
    );
    return {
      revision,
      requested: null,
      started: run.time,
      nextPlan: run.time + AUTOPLAY.replanSeconds,
      options,
      plan,
      source: 'local',
      teleportRevision: run.teleportRevision,
      snapshot: {
        controller: 'clu',
        time: run.time,
        units: 'meters, seconds, radians; Y up; forward is -Z (s = -Z)',
        self: {
          id: 'clu',
          x: run.x,
          s: run.s,
          yaw: run.yaw,
          speed: run.speed,
          health: run.health,
          turretYaw: run.turretYaw,
          turbo: {
            remainingSeconds: run.turboRemaining,
            cooldownSeconds: run.turboCooldown,
            speedMultiplier: TURBO.speedMultiplier,
          },
        },
        visibleEnemies: this.contacts,
        visibleDebris: visibleDebris(run)
          .sort((a, b) => distance(run, a) - distance(run, b))
          .slice(0, DEBRIS_AVOIDANCE.snapshotLimit),
        threatIds: threats.map((e) => e.id),
        objective: {
          goal: 'Turn every red data beam blue',
          activeBeamId: this.objectiveId,
          bearingConvention:
            'Relative to hull heading: 0 ahead, positive right, negative left; radians',
          remaining: run.dataBeams.filter((b) => b.collectedAt === null).length,
          total: run.dataBeams.length,
          activationRadiusMeters: DATA_BEAM.radius,
          maximumActivationSpeedMetersPerSecond: DATA_BEAM.stopSpeed,
          transferSeconds: DATA_BEAM.transferSeconds,
          rule: 'Stop inside the beam and remain until it is blue; then move to another red beam.',
        },
        objectives: run.dataBeams.map((b) => ({
          id: b.id,
          x: b.x,
          s: b.s,
          distanceMeters: distance(run, b),
          bearingRadians: -angleDelta(run.yaw, -Math.atan2(b.x - run.x, b.s - run.s)),
          collected: b.collectedAt !== null,
          state:
            b.collectedAt !== null
              ? 'blue'
              : b.transferStartedAt !== null
                ? 'transitioning'
                : 'red',
          remainingTransferSeconds:
            b.collectedAt !== null
              ? 0
              : b.transferStartedAt === null
                ? DATA_BEAM.transferSeconds
                : Math.max(0, DATA_BEAM.transferSeconds - (run.time - b.transferStartedAt)),
        })),
        map: nearbyWalls(run.x, run.s, 180)
          .slice(0, 32)
          .map((w) => ({ height: w.height, points: w.points })),
        recentPositions: this.visited.slice(-8),
        options,
      },
    };
  }
}
