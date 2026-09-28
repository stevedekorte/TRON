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
  clearKeys(){this.keys.clear();this.turretCenterChord=false;}
  clear() {
    this.clearKeys();
    this.mouseFire = false;
    this.fireQueued = false;
    this.cycleTurnQueued = 0;
    this.cycleReverseQueued = false;
    this.mouseTarget = null;
  }
  release(key){
    this.keys.delete(key);
    if(!this.keys.has('KeyJ')&&!this.keys.has('KeyL'))this.turretCenterChord=false;
  }
  consume() {
    this.fireQueued = false;
    this.cycleTurnQueued = 0;
    this.cycleReverseQueued = false;
    this.mouseTarget = null;
  }
  command(run, { mouseLook, mouseTarget } = {}) {
    const held = (...keys) => keys.some((key) => this.keys.has(key));
    const road=run.playerVehicle==='cycle'&&run.cycleRace?.cycles[run.cycleRace.playerId]?.escaped;
    return {
      cycleTurn:this.cycleTurnQueued,
      cycleRoad:road?{cruise:true,speedAdjust:held('KeyS')?-1:Number(held('KeyW')),reverse:this.cycleReverseQueued,turbo:held('KeyI')&&!held('KeyX'),brake:held('KeyX'),steer:Number(held('KeyD','ArrowRight'))-Number(held('KeyA','ArrowLeft'))}:{},
      cycleTurbo:run.playerVehicle==='cycle'&&held('KeyW','KeyI')&&!held('KeyS','KeyK','KeyX'),
      cycleSlow:run.playerVehicle==='cycle'&&held('KeyS','KeyK','KeyX'),
      throttle: held('KeyS', 'ArrowDown')
        ? -1
        : Number(this.startingThrottle || run.cruiseThrottle || held('KeyW', 'ArrowUp')),
      steer: Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft')),
      mouseTarget: mouseLook ? mouseTarget : this.mouseTarget,
      firePressed: this.fireQueued,
      fire: held('Space') || this.mouseFire || this.fireQueued,
      turret: this.turretCenterChord?0:Number(held('KeyL')) - Number(held('KeyJ')),
      aimPitch: run.gunner ? Number(held('KeyI')) - Number(held('KeyK')) : 0,
    };
  }
  dispose() {
    for (const remove of this.cleanups.splice(0)) remove();
    this.clear();
  }
}
