export const CLU_HEALTH=Object.freeze({max:3,rechargeSeconds:300});
export const CLU_WEAPON=Object.freeze({speed:165,lifetime:5,assistRange:740,recharge:.38,reserveRecharge:10,maxExtraShots:3,yawSpread:.6*Math.PI/180,pitchSpread:.3*Math.PI/180});
export const GUNNER=Object.freeze({fovs:[63,35,18,9],minZoom:1,mouseEnabled:false,pitchRate:.8,aimResponse:14,aimBrakeResponse:22,minPitch:0,maxPitch:1.2});
// September 14: 30% larger than the previous half-scale Recognizers.
export const RECOGNIZER_SCALE = .65;
export const TURBO=Object.freeze({duration:10,rechargeSeconds:60,speedMultiplier:2.5,accelerationMultiplier:2.5,reverseRatio:.75});
export const defaults = Object.freeze({
  aiMode:'classic',aiSmallEncounter:false,aiConfidence:.25,
  acceleration: 11, braking: 22, maxSpeed: 22, reverseSpeed: 16.5,
  turretSpeed: 1.2, steering: 1.25, drag: 4, tankRadius: 3.5,
  cameraDistance: 19, cameraHeight: 8, cameraLag: 5, fov: 63,
  enemySpeed: 29.7, // m/s; pursuit requests 1.15× this cruise speed.
  bloom: 0.36, fog: 0.0024, renderScale: 1,
});
export const config = { ...defaults };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const gunnerAimScale=zoom=>Math.tan(GUNNER.fovs[zoom]*Math.PI/360)/Math.tan(GUNNER.fovs[0]*Math.PI/360);
