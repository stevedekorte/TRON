import {clamp,RECOGNIZER_SCALE} from '../game/config.js';

// Horizontal flight: m/s² thrust, radians/s yaw, and inverse-seconds drag.
export const FLIGHT=Object.freeze({acceleration:22,turnRate:.62,drag:.7,brakeDrag:2.4,avoidanceRadius:130*RECOGNIZER_SCALE});
export function advanceFlight(e,dt,thrust=0,braking=0) {
  const drag=FLIGHT.drag+clamp(braking,0,1)*FLIGHT.brakeDrag;
  const decay=Math.exp(-drag*dt),integral=(1-decay)/drag;
  const acceleration=clamp(thrust,0,FLIGHT.acceleration);
  const ax=-Math.sin(e.yaw)*acceleration,as=Math.cos(e.yaw)*acceleration;
  // Drag slows existing momentum; only forward thrust adds new momentum.
  e.x+=e.vx*integral+ax*(dt-integral)/drag;
  e.s+=e.vs*integral+as*(dt-integral)/drag;
  e.vx=e.vx*decay+ax*integral;e.vs=e.vs*decay+as*integral;
}
