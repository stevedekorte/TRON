/**
 * @typedef {Object} VehicleCommand
 * @property {number} throttle Forward/reverse demand, -1..1.
 * @property {number} steer Yaw demand, -1..1.
 * @property {number} turret Turret yaw demand, -1..1.
 * @property {number} [aimPitch] Barrel elevation in radians.
 * @property {boolean} [fire] Held firing request.
 * @property {boolean} [firePressed] One-shot firing edge.
 * @property {boolean} [turbo] Request the normal timed acceleration/speed boost.
 * @property {Object|null} [mouseTarget] Observed aim target, when applicable.
 */
// Manual input owns only the channel being used; the pilot keeps planning.
export function mergeAutoplayInput(pilot, manual, keys, run) {
  const held = (...codes) => codes.some((code) => keys.has(code));
  const input = {
    ...pilot,
    mouseTarget: manual.mouseTarget,
    aimPitch: manual.aimPitch,
    fire: pilot.fire || manual.fire,
    firePressed: pilot.firePressed || manual.firePressed,
  };
  if (run.cruiseThrottle || held('KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'))
    input.throttle = manual.throttle;
  if (held('KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight')) input.steer = manual.steer;
  if (
    held('KeyJ', 'KeyL', 'KeyI', 'KeyK') ||
    manual.mouseTarget ||
    run.mouseAim ||
    run.turretCentering ||
    run.gunnerLeveling ||
    run.turretLocked
  )
    input.turret = manual.turret;
  if (
    held('KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight') ||
    run.cruiseThrottle
  )
    input.turbo = false;
  return input;
}
