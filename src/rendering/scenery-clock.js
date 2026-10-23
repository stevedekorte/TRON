// Multiplayer scenery is local: packet arrivals and round resets must not
// step its motion. Solo scenery follows the interpolated simulation clock.
export class SceneryClock {
  reset() { this.time = null; this.multiplayer = false; }
  constructor() { this.reset(); }
  sample(run, previous, alpha, dt) {
    if (run.multiplayer) {
      if (!this.multiplayer) this.time = run.time;
      else this.time += Math.max(0, dt);
      this.multiplayer = true;
    } else {
      this.multiplayer = false;
      this.time = previous.time + (run.time - previous.time) * alpha;
    }
    return this.time;
  }
}
