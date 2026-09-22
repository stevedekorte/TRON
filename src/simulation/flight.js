import {clamp,angleDelta,RECOGNIZER_SCALE} from '../game/config.js';

// Thrust/lift acceleration: m/s²; yaw rate: rad/s; yaw acceleration: rad/s²;
// response and drag: inverse seconds; vertical speed: m/s.
// Thrust authority supports the 10% higher cruise/pursuit speeds against drag.
export const FLIGHT_DEFAULTS=Object.freeze({acceleration:24.2,turnRate:.62,turnAcceleration:.8,turnResponse:1.8,liftAcceleration:14,liftSpeed:22,liftResponse:1.4,drag:.7,brakeDrag:2.4,avoidanceRadius:130*RECOGNIZER_SCALE});
export const FLIGHT={...FLIGHT_DEFAULTS};
export function advanceFlight(e,dt,thrust=0,braking=0) {
  const FLIGHT=flightFor(e);
  const drag=FLIGHT.drag+clamp(braking,0,1)*FLIGHT.brakeDrag;
  const decay=Math.exp(-drag*dt),integral=(1-decay)/drag;
  const acceleration=clamp(thrust,0,FLIGHT.acceleration);
  const ax=-Math.sin(e.yaw)*acceleration,as=Math.cos(e.yaw)*acceleration;
  // Drag slows existing momentum; only forward thrust adds new momentum.
  e.x+=e.vx*integral+ax*(dt-integral)/drag;
  e.s+=e.vs*integral+as*(dt-integral)/drag;
  e.vx=e.vx*decay+ax*integral;e.vs=e.vs*decay+as*integral;
}


// Steer toward a heading, or brake rotation when no heading is requested.
// Velocity persists across navigation states; only acceleration can change it.
export function advanceYaw(e,dt,heading=null){
 const FLIGHT=flightFor(e);
 const error=heading===null?0:angleDelta(e.yaw,heading);
 const target=Math.sign(error)*Math.min(FLIGHT.turnRate,Math.abs(error)*FLIGHT.turnResponse,Math.sqrt(2*FLIGHT.turnAcceleration*Math.abs(error)));
 const before=e.yawVelocity||0;
 e.yawVelocity=before+clamp(target-before,-FLIGHT.turnAcceleration*dt,FLIGHT.turnAcceleration*dt);
 e.yaw+=(before+e.yawVelocity)*.5*dt;
}
export function advanceLift(e,dt,altitude,maxSpeed=flightFor(e).liftSpeed){
 const FLIGHT=flightFor(e);
 const error=altitude-e.y;
 const target=Math.sign(error)*Math.min(maxSpeed,Math.abs(error)*FLIGHT.liftResponse,Math.sqrt(2*FLIGHT.liftAcceleration*Math.abs(error)));
 const before=e.vy||0;
 e.vy=before+clamp(target-before,-FLIGHT.liftAcceleration*dt,FLIGHT.liftAcceleration*dt);
 e.y+=(before+e.vy)*.5*dt;
}

export const flightFor=e=>e?.settings?.flight || FLIGHT;
