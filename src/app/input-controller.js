/** Held manual channels and owned browser listeners. Application actions remain callbacks. */
export class InputController {
  constructor() {
    this.keys = new Set();
    this.cleanups = [];
    this.clear();
  }
  listen(object, event, handler, options) {
    object.addEventListener(event, handler, options);
    this.cleanups.push(() => object.removeEventListener(event, handler, options));
  }
  clear() {
    this.keys.clear();
    this.mouseFire = false;
    this.fireQueued = false;
    this.mouseTarget = null;
  }
  consume() {
    this.fireQueued = false;
    this.mouseTarget = null;
  }
  command(run, { mouseLook, mouseTarget } = {}) {
    const held = (...keys) => keys.some((key) => this.keys.has(key));
    return {
      throttle: held('KeyS', 'ArrowDown')
        ? -1
        : Number(this.startingThrottle || run.cruiseThrottle || held('KeyW', 'ArrowUp')),
      steer: Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft')),
      mouseTarget: mouseLook ? mouseTarget : this.mouseTarget,
      firePressed: this.fireQueued,
      fire: held('Space') || this.mouseFire || this.fireQueued,
      turret: Number(held('KeyL')) - Number(held('KeyJ')),
      aimPitch: run.gunner ? Number(held('KeyI')) - Number(held('KeyK')) : 0,
    };
  }
  dispose() {
    for (const remove of this.cleanups.splice(0)) remove();
    this.clear();
  }
}
