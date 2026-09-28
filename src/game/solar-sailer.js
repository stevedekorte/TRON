import { carrierFor } from './carrier.js';

export const SOLAR_SAILER_DEFAULTS = Object.freeze({
  enabled: true,
  backgroundLoadSeconds: 30,
  scale: 2.5,
  altitudeMeters: 520,
  carrierOffsetMeters: 600,
  speedMetersPerSecond: 280,
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

// A fixed world-space lane parallel to the carrier's +X course. No camera or
// player tracking: simulation time alone controls transit, pause and restart.
export function solarSailerPose(time, world, settings = SOLAR_SAILER) {
  const elapsed = time - settings.firstPassSeconds;
  const phase = ((elapsed % settings.periodSeconds) + settings.periodSeconds) % settings.periodSeconds;
  const duration = settings.travelMeters / settings.speedMetersPerSecond;
  const distance = phase * settings.speedMetersPerSecond;
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
    visible: settings.enabled && elapsed >= 0 && phase < duration,
    opacity: Math.max(0, Math.min(1, distance / settings.edgeFadeMeters,
      (settings.travelMeters - distance) / settings.edgeFadeMeters)),
  };
}
