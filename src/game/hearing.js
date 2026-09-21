// Gameplay acoustics: meters, seconds, radians, normalized pressure amplitude.
// These are perception tunables, independent of the player's audio volume/mute.
export const HEARING_DEFAULTS=Object.freeze({engineIntervalSeconds:1,memorySeconds:10,maxReports:6,
 wallAmplitude:.25,bearingErrorRadians:.28,distanceErrorFraction:.25,
 engineIdleRangeMeters:35,engineMovingRangeMeters:100,aircraftRangeMeters:150,
 cannonRangeMeters:650,explosionRangeMeters:950,impactRangeMeters:200,
 investigateScore:65,replanSeconds:4});

export const HEARING={...HEARING_DEFAULTS};
