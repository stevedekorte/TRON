import {LIGHT_CYCLES as C} from '../config/light-cycles.js';
export function nextCycleSpeed(speed,target,boosting,seconds){
 return speed+(target-speed)*(1-Math.exp(-(target>speed&&boosting?C.turboResponsePerSecond:C.speedResponsePerSecond)*seconds));
}
// Same step order as authority: travel at the current speed, then update speed.
// A held exhausted request does not recharge. Caller supplies reusable output.
export function forecastSpeed(b,pedal,seconds,out){
 let speed=b.speedMultiplier??1,distance=0,remaining=seconds;
 let charge=pedal===1?b.turboCharge??1:pedal===-1?b.brakeCharge??1:0;
 const duration=pedal===1?C.turboDurationSeconds:C.brakeDurationSeconds,initial=charge;
 while(remaining>1e-9){
  const active=pedal!==0&&charge>1e-9,step=Math.min(remaining,C.speedStepSeconds,active?charge*duration:Infinity);
  const target=active?(pedal===1?C.turboSpeedMultiplier:C.slowSpeedMultiplier):1;
  distance+=speed*C.speedMetersPerSecond*step;
  speed=nextCycleSpeed(speed,target,active&&pedal===1,step);
  if(active)charge=Math.max(0,charge-step/duration);remaining-=step;
 }
 out.distance=distance;out.speed=speed;out.spent=initial-charge;return out;
}
export function arrivalSeconds(b,pedal,meters,limit=2){
 if(meters<=0)return 0;
 let speed=b.speedMultiplier??1,time=0,charge=pedal===1?b.turboCharge??1:pedal===-1?b.brakeCharge??1:0;
 const duration=pedal===1?C.turboDurationSeconds:C.brakeDurationSeconds;
 while(time<limit-1e-9){
  const active=pedal!==0&&charge>1e-9,dt=Math.min(C.speedStepSeconds,limit-time,active?charge*duration:Infinity),travel=speed*C.speedMetersPerSecond*dt;
  if(travel>=meters)return time+meters/(speed*C.speedMetersPerSecond);
  meters-=travel;speed=nextCycleSpeed(speed,active?(pedal===1?C.turboSpeedMultiplier:C.slowSpeedMultiplier):1,active&&pedal===1,dt);
  if(active)charge=Math.max(0,charge-dt/duration);time+=dt;
 }
 return Infinity;
}
