// User reference estimate: an upright Recognizer leg is about 30 ft (9 m).
export const RECOGNIZER_SCALE = .5;
export const TURBO=Object.freeze({duration:10,rechargeSeconds:60,speedMultiplier:2.5});
export const defaults = Object.freeze({
  acceleration: 11, braking: 22, maxSpeed: 22, reverseSpeed: 8,
  turretSpeed: 1.2, steering: 1.25, drag: 4, tankRadius: 3.5,
  cameraDistance: 19, cameraHeight: 8, cameraLag: 5, fov: 63,
  enemySpeed: 27,
  bloom: 0.36, fog: 0.0024, renderScale: 1,
});
export const config = { ...defaults };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
