import {radioRangeFor} from './communication.js';
// Distances in meters; times in seconds. Classic is the off switch; the browser starts in Jev mode.
export const TACTICAL=Object.freeze({plansPerTick:1,jevRangeMazeLengths:1,jevMemoryMaxAgeSeconds:38,replanSeconds:4,commitSeconds:3,requestMaxAge:2.5,radioRange:radioRangeFor(null),mapRadius:240,
 eventCooldownSeconds:.65,velocityChangeMetersPerSecond:8,targetShiftMeters:45,searchArrivalMeters:35,searchRadiusMeters:160,searchLeadSeconds:2,searchStepMeters:8,searchNodeLimit:1800,searchCheckedRadiusMeters:18,searchVisitMeters:12,
 interceptTrackToleranceMeters:8,attackApproachMeters:80,supportOffsetMeters:60,clearance:.8,sweepStep:.5,yawStep:Math.PI/90,routeStep:12,routeNodes:450,routeRadius:144,
 lowAltitude:22,cruiseSpeedMultiplier:1.15,lowSpeed:7,arrivalDistance:1.2,arrivalAngle:.035,routeLookAheadSeconds:1.5,
 retreatHealth:1,retreatDistance:140,regroupDistance:80,confidence:.25,requestInterval:.6,requestTimeoutMs:2500});
export const AI_MODES=['classic','local','jev'];
