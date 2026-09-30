import {VectorKeyframeTrack, NumberKeyframeTrack, InterpolateSmooth, Vector3, MathUtils} from 'three';
import {LIGHT_CYCLES} from '../game/light-cycles.js';
import {ARENA_WALL} from '../game/arena-breaches.js';
// Preserve the supplied clip's 00:00–00:16 move, then hold its endpoint
// for the gold team's materialization before cutting to the player camera.
export const CYCLE_OPENING=Object.freeze({startSeconds:1,durationSeconds:16,travelSeconds:16,formationSeconds:2.75/1.5,launchHoldSeconds:.6,raceReleaseFraction:1,lookDistanceMeters:100,minimumHeightMeters:4});
// Relative phase timing, scaled to the formation's overall duration.
export const CYCLE_FORMATION_MATERIALIZATION=Object.freeze({openSeconds:.6,passSeconds:1.4,fadeSeconds:.75});
export const CYCLE_FORMATION_CAMERA=Object.freeze({blendStartSeconds:14,rightMeters:8,forwardMeters:5,heightMeters:1.6,lookRightMeters:1.5,lookHeightMeters:.65,fovDegrees:38});
const formationZ=-Math.floor((ARENA_WALL.innerMeters-LIGHT_CYCLES.lengthMeters/2-LIGHT_CYCLES.startWallClearanceMeters)/LIGHT_CYCLES.cellMeters)*LIGHT_CYCLES.cellMeters;
export function cycleFormationBlend(progress){return MathUtils.smootherstep(progress*CYCLE_OPENING.durationSeconds,CYCLE_FORMATION_CAMERA.blendStartSeconds,CYCLE_OPENING.durationSeconds);}
// Film opening: carrier broadside beyond the maze, to the camera's right.
// The shallow heading exposes the open bow on the right, as in the film still.
export const CYCLE_OPENING_CARRIER=Object.freeze({xOffsetMeters:-3000,sOffsetMeters:1550,altitudeMeters:360,yawRadians:.15,speedMetersPerSecond:18,setbackMeters:800});
export function applyCycleOpeningCarrier(ship,progress,site){
 const c=CYCLE_OPENING_CARRIER,time=MathUtils.clamp(progress,0,1)*CYCLE_OPENING.durationSeconds;
 const travel=c.speedMetersPerSecond*time-c.setbackMeters;
 ship.position.set(site.x+c.xOffsetMeters+Math.cos(c.yawRadians)*travel,c.altitudeMeters,-site.s-c.sOffsetMeters-Math.sin(c.yawRadians)*travel);
 ship.rotation.set(0,c.yawRadians,0);
}
// Timed arena-local meters: retreat over the entry wall, descend continuously, then cross the
// grid rapidly. The west wall looks back toward the central labyrinth.
const times=[0,3,5,7,9,10.5,12,14,16];
const positions=[
 -475,110,320, -440,101,320, -385,70,315,
 -335,25,270, -265,12,185, -180,7,70,
 -85,4,-100, 0,4,-320, 0,4,-370,
];
// Clockwise pan from west to north; pitch is downward from the horizon.
// Keep the floor dominant before the fast traverse, then lift for arrival.
const yaws=[-90,-90,-88,-70,-40,-10,0,0,0];
const pitches=[-4,-7,-12,-28,-50,-65,-30,-5,0];
const radians=values=>values.map(MathUtils.degToRad);
const route=new VectorKeyframeTrack('position',times,positions,InterpolateSmooth).createInterpolant();
const yawTrack=new NumberKeyframeTrack('yaw',times,radians(yaws),InterpolateSmooth).createInterpolant();
const pitchTrack=new NumberKeyframeTrack('pitch',times,radians(pitches),InterpolateSmooth).createInterpolant();
const point=new Vector3(),direction=new Vector3();
export function applyCycleOpening(progress,site,position,look){
 const seconds=MathUtils.clamp(progress,0,1)*CYCLE_OPENING.durationSeconds;
 point.fromArray(route.evaluate(seconds));
 point.y=Math.max(CYCLE_OPENING.minimumHeightMeters,point.y);
 const yaw=yawTrack.evaluate(seconds)[0],pitch=pitchTrack.evaluate(seconds)[0];
 direction.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 position.set(point.x+site.x,point.y,point.z-site.s);
 look.copy(direction).multiplyScalar(CYCLE_OPENING.lookDistanceMeters).add(position);
 const blend=cycleFormationBlend(progress),c=CYCLE_FORMATION_CAMERA;
 position.lerp(new Vector3(site.x+c.rightMeters,c.heightMeters,formationZ-site.s+c.forwardMeters),blend);
 look.lerp(new Vector3(site.x+c.lookRightMeters,c.lookHeightMeters,formationZ-site.s),blend);
 // The diagonal grid comes from the pan and pitch, not an aircraft roll.
 return 0;
}
