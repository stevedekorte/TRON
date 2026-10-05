import { carrierFor } from './carrier.js';

export const SOLAR_SAILER_DEFAULTS = Object.freeze({
  enabled: true,
  backgroundLoadSeconds: 30,
  scale: 2.5,
  altitudeMeters: 520,
  carrierOffsetMeters: 600,
  speedMetersPerSecond: 280,
  fullSailSpeedMultiplier: 4,
  chargeAfterSeconds: 12,
  chargeDurationSeconds: 3,
  periodSeconds: 180,
  firstPassSeconds: 180,
  travelMeters: 12000,
  beamLengthMeters: 24000,
  edgeFadeMeters: 1200,
  beamRadiusMeters: 0.65,
  beamFadeInSeconds: 3,
  beamFadeOutSeconds: 9,
});
export const SOLAR_SAILER = { ...SOLAR_SAILER_DEFAULTS };

// Integral of smoothstep keeps velocity and position continuous as sails fill.
export function solarSailerTransit(seconds, settings = SOLAR_SAILER) {
  const t=Math.max(0,seconds),start=settings.chargeAfterSeconds,span=settings.chargeDurationSeconds;
  const u=Math.max(0,Math.min(1,(t-start)/span));
  const charge=u*u*(3-2*u);
  const extra=span*(u*u*u-.5*u*u*u*u)+Math.max(0,t-start-span);
  const speed=settings.speedMetersPerSecond,boost=settings.fullSailSpeedMultiplier-1;
  return {charge,speedMetersPerSecond:speed*(1+boost*charge),distance:speed*(t+boost*extra)};
}
export function solarSailerDuration(settings = SOLAR_SAILER) {
  let low=0,high=settings.travelMeters/settings.speedMetersPerSecond;
  for(let i=0;i<50;i++){const mid=(low+high)/2;if(solarSailerTransit(mid,settings).distance<settings.travelMeters)low=mid;else high=mid;}
  return (low+high)/2;
}

// A fixed world-space lane parallel to the carrier's +X course. No camera or
// player tracking: simulation time alone controls transit, pause and restart.
export function solarSailerPose(time, world, settings = SOLAR_SAILER) {
  const elapsed = time - settings.firstPassSeconds;
  const phase = ((elapsed % settings.periodSeconds) + settings.periodSeconds) % settings.periodSeconds;
  const duration = solarSailerDuration(settings);
  const {distance,charge,speedMetersPerSecond} = solarSailerTransit(phase,settings);
  const smooth = value => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const fadeIn = settings.beamFadeInSeconds, fadeOut = settings.beamFadeOutSeconds;
  // Anticipate the next crossing, then leave a short trailing fade. Before
  // the first pass there is no previous crossing whose tail can remain lit.
  const beamOpacity = !settings.enabled ? 0 : elapsed < 0
    ? smooth((elapsed + fadeIn) / fadeIn)
    : Math.max(1 - smooth((phase - duration) / fadeOut),
      smooth((phase - settings.periodSeconds + fadeIn) / fadeIn));
  return {
    x: world.SPAWN.x - settings.travelMeters / 2 + distance,
    y: settings.altitudeMeters,
    z: -(carrierFor(world).s + settings.carrierOffsetMeters),
    beamOpacity,
    charge,speedMetersPerSecond,
    sailState:charge===1?'full':charge===0?'translucent':'charging',
    visible: settings.enabled && elapsed >= 0 && phase < duration,
    opacity: Math.max(0, Math.min(1, distance / settings.edgeFadeMeters,
      (settings.travelMeters - distance) / settings.edgeFadeMeters)),
  };
}
