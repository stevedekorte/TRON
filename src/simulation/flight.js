import {clamp,angleDelta,RECOGNIZER_SCALE} from '../game/config.js';

// Thrust/lift acceleration: m/s²; yaw rate: rad/s; yaw acceleration: rad/s²;
// response and drag: inverse seconds; vertical speed: m/s.
// Thrust authority supports the 10% higher cruise/pursuit speeds against drag.
export const FLIGHT_DEFAULTS=Object.freeze({acceleration:24.2,maneuverSpeedMetersPerSecond:3,sidewaysSpeedRatio:.5,reverseSpeedRatio:.5,turnRate:.62,turnAcceleration:.8,turnResponse:1.8,liftAcceleration:14,liftSpeed:22,liftResponse:1.4,drag:.7,brakeDrag:2.4,avoidanceRadius:130*RECOGNIZER_SCALE});
export const FLIGHT={...FLIGHT_DEFAULTS};
export function advanceFlight(e,dt,thrust=0,braking=0) {
  thrust=clamp(thrust,0,flightFor(e).acceleration);
  advanceFlightVector(e,dt,-Math.sin(e.yaw)*thrust,Math.cos(e.yaw)*thrust,braking);
}
// Directional thrust has one shared acceleration budget, including diagonals.
export function advanceFlightVector(e,dt,ax,as,braking=0){
 const flight=flightFor(e),magnitude=Math.hypot(ax,as);
 if(magnitude>flight.acceleration){ax*=flight.acceleration/magnitude;as*=flight.acceleration/magnitude;}
 const drag=flight.drag+clamp(braking,0,1)*flight.brakeDrag;
 const decay=Math.exp(-drag*dt),integral=(1-decay)/drag;
 e.x+=e.vx*integral+ax*(dt-integral)/drag;
 e.s+=e.vs*integral+as*(dt-integral)/drag;
 e.vx=e.vx*decay+ax*integral;e.vs=e.vs*decay+as*integral;
}
export function advanceFlightToward(e,dt,dx,ds,speed){
 const flight=flightFor(e),distance=Math.hypot(dx,ds);
 if(!speed||!distance){advanceFlight(e,dt,0,1);return;}
 speed=directionalFlightSpeed(e,dx,ds,speed);
 const vx=dx/distance*speed,vs=ds/distance*speed;
 advanceFlightVector(e,dt,flight.drag*vx+(vx-e.vx)*1.4,flight.drag*vs+(vs-e.vs)*1.4,clamp((Math.hypot(e.vx,e.vs)-speed)/5,0,1));
}
export function directionalFlightSpeed(e,dx,ds,speed){
 const flight=flightFor(e),distance=Math.hypot(dx,ds);
 if(!distance)return 0;
 // Elliptical speed envelope in hull coordinates: full forward speed,
 // lateral/reverse motion is limited to slow positioning, even at cruise.
 const forward=(-Math.sin(e.yaw)*dx+Math.cos(e.yaw)*ds)/distance;
 const lateral=(Math.cos(e.yaw)*dx+Math.sin(e.yaw)*ds)/distance;
 const lateralSpeed=Math.min(speed*flight.sidewaysSpeedRatio,flight.maneuverSpeedMetersPerSecond);
 const reverseSpeed=Math.min(speed*flight.reverseSpeedRatio,flight.maneuverSpeedMetersPerSecond);
 return 1/Math.hypot(forward/(forward>=0?speed:reverseSpeed),lateral/lateralSpeed);

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

// Keep a turn's radius inside the remaining approach distance. A distant goal
// allows full cruise even behind the craft; nearby goals require a slower arc.
export const FLIGHT_APPROACH=Object.freeze({turnTimeMargin:2,responseSeconds:1});
export function approachSpeed(e, heading, distance, requestedSpeed) {
 const turnSeconds=FLIGHT_APPROACH.turnTimeMargin*Math.abs(angleDelta(e.yaw,heading))/flightFor(e).turnRate;
 return Math.min(requestedSpeed,distance/(FLIGHT_APPROACH.responseSeconds+turnSeconds));
}
