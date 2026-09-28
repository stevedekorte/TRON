export const LOOP_TIMING = Object.freeze({
  fixedSeconds: 1 / 60,
  cycleFixedSeconds: 1 / 120,
  foregroundLimitSeconds: 0.1,
  backgroundLimitSeconds: 1,
  backgroundIntervalMs: 250,
});
// Arena turns need 120 Hz. Road movement already substeps at 120 Hz internally;
// keep the surrounding enemy simulation at the normal 60 Hz world cadence.
export const simulationStepSeconds=run=>run.playerVehicle==='cycle'&&!run.cycleRace?.cycles[run.cycleRace.playerId]?.escaped
  ?LOOP_TIMING.cycleFixedSeconds:LOOP_TIMING.fixedSeconds;
/** Owns exactly one scheduled callback and the fixed-step accumulator. */
export class GameLoop {
  constructor({
    frame,
    hidden = () => document.hidden,
    backgroundAllowed = () => false,
    clock = () => performance.now(),
    requestFrame = (fn) => requestAnimationFrame(fn),
    cancelFrame = (id) => cancelAnimationFrame(id),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  }) {
    Object.assign(this, {
      frame,
      hidden,
      backgroundAllowed,
      clock,
      requestFrame,
      cancelFrame,
      setTimer,
      clearTimer,
    });
    this.accumulator = 0;
    this.fixedSeconds = LOOP_TIMING.fixedSeconds;
    this.lastTime = null;
    this.disposed = false;
    this.running = false;
    this.generation = 0;
  }
  resetAccumulator() {
    this.accumulator = 0;
  }
  get alpha() {
    return this.accumulator / this.fixedSeconds;
  }
  start() {
    if (this.disposed || this.running) return;
    this.running = true;
    this.schedule();
  }
  reschedule() {
    this.lastTime = this.clock();
    if (this.running) this.schedule();
  }
  schedule() {
    this.cancelFrame(this.frameId);
    this.clearTimer(this.timerId);
    this.frameId = this.timerId = null;
    const generation = ++this.generation;
    if (this.disposed || !this.running) return;
    const tick = (ms) => {
      if (this.disposed || generation !== this.generation) return;
      const background = this.hidden() && this.backgroundAllowed();
      const dt = Math.max(
        0,
        Math.min(
          background ? LOOP_TIMING.backgroundLimitSeconds : LOOP_TIMING.foregroundLimitSeconds,
          (ms - (this.lastTime ?? ms)) / 1000,
        ),
      );
      this.lastTime = ms;
      this.frame(dt, background);
      this.schedule();
    };
    if (this.hidden())
      this.timerId = this.setTimer(() => tick(this.clock()), LOOP_TIMING.backgroundIntervalMs);
    else this.frameId = this.requestFrame(tick);
  }
  advance(dt, background, playing, step, fixedSeconds = LOOP_TIMING.fixedSeconds) {
    this.fixedSeconds = fixedSeconds;
    this.accumulator += dt;
    let count = 0;
    const max = background
      ? Math.ceil(LOOP_TIMING.backgroundLimitSeconds / fixedSeconds)
      : Math.ceil(LOOP_TIMING.foregroundLimitSeconds / fixedSeconds);
    while (this.accumulator >= fixedSeconds && count++ < max && playing()) {
      step(fixedSeconds);
      this.accumulator -= fixedSeconds;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.generation++;
    this.cancelFrame(this.frameId);
    this.clearTimer(this.timerId);
  }
}
