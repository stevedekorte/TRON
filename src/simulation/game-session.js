import { updateCycleArenaPatrol } from './arena-patrol.js';
import {ROAD_CYCLE,validateRoadCycle} from '../game/cycle-road.js';
import {LIGHT_CYCLES,CYCLE_TESTING} from '../game/light-cycles.js';
import { attachCycleWorld, createCycleRace, updateCycleRace, resetCycleRound, cyclePlayerPose } from './light-cycles.js';
import { config, CLU_HEALTH, attachSettings } from '../game/config.js';
import { FLIGHT } from './flight.js';
import { HEARING } from '../game/hearing.js';
import { createRun, step, stepCycleWorld } from './run.js';
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
      roadCycle: validateRoadCycle({...ROAD_CYCLE,...settings?.roadCycle}),
      cycleEndings: settings?.cycleEndings ?? CYCLE_TESTING.endingsEnabled,
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
    this.run.cycleRace = createCycleRace(this.world, this.run.seed);
    if(this.run.cycleRace)this.run.cycleRace.roadConfig=this.settings.roadCycle;
    if(this.run.cycleRace)this.run.cycleRace.phase='idle';
    this.previous = { ...this.run };
    return this.run;
  }
  restartCycleMatch() {
    const r=this.run,race=r.cycleRace;
    if(r.playerVehicle!=='cycle'||!race||race.cycles[race.playerId].alive&&race.phase!=='result')return false;
    resetCycleRound(race);r.won=false;r.crushed=false;r.health=3;
    r.radio=[];
    for(const e of [...r.recognizers,...r.enemyTanks]){
      e.targetGone=false;e.neutralizationSent=false;e.nextSense=r.time;
    }
    Object.assign(r,cyclePlayerPose(race));this.previous={...r};
    r.events.push({type:'cycleRetry'});return true;
  }
  requestCycleEntry({startOutside=false,startWithBreach,hideMiddleOpponent,entranceFormation=false}={}) {
    if(!this.run.cycleRace)return;
    Object.assign(this.run.cycleRace,{startOutside,startWithBreach,hideMiddleOpponent,entranceFormation});
    this.run.cycleEntryRequested=true;this.run.arenaWaiting=true;this.run.speed=0;
  }
  attachDebris(physics, presentation) {
    this.physics = physics;
    this.debris = presentation;
  }
  advance(input, dt, {holdCycleRace=false}={}) {
    const r = this.run,
      revision = r.teleportRevision;
    this.previous = { x: r.x, s: r.s, yaw: r.yaw, turretYaw: r.turretYaw, aimPitch: r.aimPitch };
    // step(): teleport/hearing, transfer lock, motors, carrier/enemies,
    // weapons, beam completion, teleport/hearing. Retain these same-tick boundaries.
    if(r.playerVehicle==='cycle'&&holdCycleRace){
      r.time+=dt;updateCycleArenaPatrol(r,dt);
      return r.events.splice(0);
    }
    if(r.playerVehicle==='cycle'){
      if(!r.won&&!r.crushed){
        r.time+=dt;updateCycleRace(r.cycleRace,dt,input.cycleTurn,input.cycleTurbo,input.cycleSlow,input.cycleRoad);
        Object.assign(r,cyclePlayerPose(r.cycleRace));r.speed=0;
        const bike=r.cycleRace.cycles[r.cycleRace.playerId];
        if(bike.escaped){
          r.speed=bike.roadSpeed;r.health=(bike.roadHealth??1)*CLU_HEALTH.max;
          r.crushed=!bike.alive;
          stepCycleWorld(r,dt);
          bike.roadHealth=Math.max(0,r.health/CLU_HEALTH.max);
          if(bike.alive&&(r.crushed||bike.roadHealth<=0)){
            bike.alive=false;bike.roadSpeed=0;bike.roadHealth=0;
            r.cycleRace.crashes.push({id:bike.id,x:bike.x,z:bike.z,team:bike.team,dir:bike.dir,time:r.cycleRace.time});
          }
          // Cycle deaths use the cycle explosion/spectator flow, not tank debris.
          r.events=r.events.filter(e=>!(e.subject==='tank'&&e.type==='destroyed'));
          r.crushed=false;
        }else updateCycleArenaPatrol(r,dt);
        if(!bike.escaped&&this.settings.cycleEndings&&r.cycleRace.phase==='result'){
          if(r.cycleRace.winner===r.cycleRace.cycles[r.cycleRace.playerId].team){r.won=true;r.events.push({type:'victory'});}
          else{
            if(!r.cycleRace.attemptResolved){r.cycleRace.attemptResolved=true;r.cycleAttemptsRemaining--;}
            if(r.cycleRace.remaining<=0){
              if(r.cycleAttemptsRemaining>0){resetCycleRound(r.cycleRace);Object.assign(r,cyclePlayerPose(r.cycleRace));this.previous={...r};r.events.push({type:'cycleRetry'});}
              else{r.crushed=true;r.health=0;}
            }
          }
        }
      }
    }else{
      if(!r.arenaWaiting)step(r, input, dt);
      const center=this.world.MAZE_INSTANCES.find(m=>m.kind==='labyrinth');
      if(!r.crushed&&!r.won&&!r.cycleEntryRequested&&center&&r.dataBeams.some(b=>b.id===center.id&&b.collectedAt!==null)){
        r.won=true;r.speed=0;r.events.push({type:'victory'});
      }
      if(!r.crushed&&!r.won&&r.cycleRace&&r.cycleEntryRequested){
        if(this.arenaReady===false){r.arenaWaiting=true;r.speed=0;return r.events.splice(0);}
        r.cycleEntryRequested=false;r.arenaWaiting=false;r.playerVehicle='cycle';r.cycleAttemptsRemaining=LIGHT_CYCLES.playerAttempts;r.cycleRace.playerId=1;resetCycleRound(r.cycleRace);
        r.won=false;r.speed=0;r.gunner=false;r.turretYaw=0;r.aimPitch=0;r.transferActive=false;
        r.projectiles=[];this.debris?.clear();this.physics?.clear();
        Object.assign(r,cyclePlayerPose(r.cycleRace));this.previous={...r};
        r.events.push({type:'cycleArrival'});
      }
    }
    if (r.teleportRevision !== revision) this.previous = { ...r };
    // Existing debris moves before this tick's destruction events spawn new pieces.
    if (this.physics && !r.won && r.playerVehicle!=='cycle') {
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
    if(this.run.cycleRace){attachCycleWorld(this.run.cycleRace,this.world);this.run.cycleRace.roadConfig=this.settings.roadCycle;}
    for (const e of [...this.run.recognizers, ...this.run.enemyTanks]) {
      attachWorld(e, this.world);
      attachSettings(e, this.settings);
    }
    this.previous = { ...this.run };
  }
  configure(group, values) {
    const target = this.settings[group];
    if (!target) throw new Error(`Unknown tuning group: ${group}`);
    if(group==='roadCycle')validateRoadCycle({...target,...values});
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
