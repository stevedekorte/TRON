import { config, attachSettings } from '../game/config.js';
import { FLIGHT } from './flight.js';
import { HEARING } from '../game/hearing.js';
import { createRun, step } from './run.js';
import { debrisVehicleTargets, applyDebrisImpacts } from './debris-damage.js';
import { DEFAULT_WORLD, attachWorld } from '../levels/scenario.js';
/** Owns one round and the ordered simulation/effect boundary. No DOM or network. */
export class GameSession {
  constructor({
    world = DEFAULT_WORLD,
    seed,
    physics = null,
    settings = world.spec.configuration,
  } = {}) {
    this.settings = {
      vehicle: { ...config, ...settings?.vehicle },
      flight: { ...FLIGHT, ...settings?.flight },
      hearing: { ...HEARING, ...settings?.hearing },
    };
    this.world = world;
    this.physics = physics;
    this.reset(seed);
  }
  reset(seed = this.world.spec.runSeed) {
    this.debris?.clear();
    this.physics?.clear();
    this.run = createRun(seed, this.world, this.settings);
    this.previous = { ...this.run };
    return this.run;
  }
  attachDebris(physics, presentation) {
    this.physics = physics;
    this.debris = presentation;
  }
  advance(input, dt) {
    const r = this.run,
      revision = r.teleportRevision;
    this.previous = { x: r.x, s: r.s, yaw: r.yaw, turretYaw: r.turretYaw, aimPitch: r.aimPitch };
    // step(): teleport/hearing, transfer lock, motors, carrier/enemies,
    // weapons, beam completion, teleport/hearing. Retain these same-tick boundaries.
    step(r, input, dt);
    if (r.teleportRevision !== revision) this.previous = { ...r };
    // Existing debris moves before this tick's destruction events spawn new pieces.
    if (this.physics) {
      this.physics.syncVehicles(debrisVehicleTargets(r));
      this.physics.update(dt);
      this.debris?.update(dt);
      applyDebrisImpacts(r, this.physics.drainImpacts());
      r.debris = this.physics.observations?.() || [];
    }
    return r.events.splice(0); // One batch, delivered to both presentation and audio.
  }
  place(data) {
    if ('yaw' in data || 'turretYaw' in data) this.run.turretHeading = null;
    Object.assign(this.run, structuredClone(data));
    for (const e of [...this.run.recognizers, ...this.run.enemyTanks]) {
      attachWorld(e, this.world);
      attachSettings(e, this.settings);
    }
    this.previous = { ...this.run };
  }
  configure(group, values) {
    const target = this.settings[group];
    if (!target) throw new Error(`Unknown tuning group: ${group}`);
    for (const key of Object.keys(values))
      if (!(key in target)) throw new Error(`Unknown setting: ${key}`);
    Object.assign(target, values);
    this.run.scenario.configuration = structuredClone(this.settings);
  }
  snapshot() {
    return structuredClone(this.run);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.debris?.clear();
    this.physics?.dispose();
  }
}
