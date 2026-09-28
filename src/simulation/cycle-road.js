import {LIGHT_CYCLES as C} from '../game/light-cycles.js';
import {ROAD_CYCLE} from '../game/cycle-road.js';
export {ROAD_CYCLE} from '../game/cycle-road.js';
export function enterRoadMode(b){
 b.escaped=true;b.yaw=-b.dir*Math.PI/2;b.roadSpeed=C.speedMetersPerSecond*(b.speedMultiplier??1);
 b.targetRoadSpeed=b.roadSpeed;b.reverseGear=false;
 b.roadHealth=1;b.steering=0;b.lean=0;b.cornerLean=0;b.boosting=false;
 // The grid's displayed position is one cell behind its committed endpoint.
 b.x=b.previousX;b.z=b.previousZ;b.progress=1;b.roadEntryCell=`${Math.round(b.x)},${Math.round(b.z)}`;
}
export function setRoadSpeedControl(b,input,c=ROAD_CYCLE){
 if(!input.cruise)return;
 b.targetRoadSpeed??=Math.max(0,b.roadSpeed);
 const adjust=Math.sign(input.speedAdjust||0);
 if(adjust){
  b.reverseGear=false;
  b.targetRoadSpeed=adjust>0?c.maxSpeedMetersPerSecond:0;
 }else if(b.roadSpeedAdjust){
  // Capture achieved speed on release, not a target still ahead of the bike.
  b.targetRoadSpeed=Math.max(0,b.roadSpeed);
 }
 b.roadSpeedAdjust=adjust;
 if(input.reverse&&Math.abs(b.roadSpeed)<.01){b.reverseGear=true;b.targetRoadSpeed=0;}
 if(input.brake&&!b.reverseGear)b.targetRoadSpeed=0;
}
export function advanceRoadCycle(b,dt,input,clear,c=ROAD_CYCLE){
 const cruise=!!input.cruise,reverse=cruise&&b.reverseGear;
 const cruiseTarget=b.targetRoadSpeed??Math.max(0,b.roadSpeed);
 const brake=reverse?true:!!input.brake||(cruise&&b.roadSpeed>cruiseTarget+.1&&!input.turbo);
 const throttle=brake?0:Number(cruise?b.roadSpeed<cruiseTarget:!!input.throttle);
 const oldSpeed=b.roadSpeed;
 b.turboCharge??=1;
 b.boosting=!!input.turbo&&!brake&&oldSpeed>=0&&b.turboCharge>1e-9;
 if(b.boosting)b.turboCharge=Math.max(0,b.turboCharge-dt/C.turboDurationSeconds);
 else if(!input.turbo||brake)b.turboCharge=Math.min(1,b.turboCharge+dt/C.turboRechargeSeconds);
 const speedLimit=b.boosting?c.turboMaxSpeedMetersPerSecond:c.maxSpeedMetersPerSecond;
 const drive=Math.max(throttle,Number(b.boosting))*c.accelerationMetersPerSecondSquared*(b.boosting?c.turboAccelerationMultiplier:1)*Math.max(0,1-(oldSpeed/speedLimit)**2);
 const drag=c.rollingDragMetersPerSecondSquared+c.aeroDragPerMeter*oldSpeed*oldSpeed;
 if(oldSpeed<0){
  const acceleration=brake?-c.reverseAccelerationMetersPerSecondSquared:throttle?c.brakeMetersPerSecondSquared:c.reverseReleaseDecelerationMetersPerSecondSquared;
  b.roadSpeed=Math.max(-c.reverseSpeedMetersPerSecond,Math.min(0,oldSpeed+acceleration*dt));
 }else if(brake){
  b.roadSpeed=oldSpeed>0?Math.max(0,oldSpeed-(drag+c.brakeMetersPerSecondSquared)*dt):cruise&&!reverse?0:-Math.min(c.reverseSpeedMetersPerSecond,c.reverseAccelerationMetersPerSecondSquared*dt);
 }else b.roadSpeed=Math.max(0,Math.min(c.turboMaxSpeedMetersPerSecond,oldSpeed+(drive-drag)*dt));
 if(cruise&&!reverse&&!input.brake&&!b.boosting&&oldSpeed>=0){
  const error=cruiseTarget-oldSpeed;
  const change=Math.max(-c.brakeMetersPerSecondSquared,Math.min(c.accelerationMetersPerSecondSquared,error*(error<0?c.brakeResponsePerSecond:c.cruiseResponsePerSecond)))*dt;
  b.roadSpeed=Math.max(0,oldSpeed+change);
  if(cruiseTarget===0&&b.roadSpeed<c.stopSpeedMetersPerSecond)b.roadSpeed=0;
 }
 if(!throttle&&!brake&&!b.boosting&&Math.abs(b.roadSpeed)<c.stopSpeedMetersPerSecond)b.roadSpeed=0;
 const steer=Math.max(-1,Math.min(1,input.steer||0));
 const speed=(oldSpeed+b.roadSpeed)/2;
 // Hold duration builds a normalized cornering demand, rather than instantly
 // saturating a wheel angle against the high-speed lateral acceleration cap.
 const absoluteSpeed=Math.abs(speed);
 const t=Math.max(0,Math.min(1,(absoluteSpeed-c.steeringBlendStartMetersPerSecond)/(c.steeringBlendEndMetersPerSecond-c.steeringBlendStartMetersPerSecond)));
 const roadBlend=t*t*(3-2*t);
 const fastBuild=c.steeringBuildSeconds*(1+absoluteSpeed/c.steeringSpeedScaleMetersPerSecond);
 const buildSeconds=c.lowSpeedSteeringBuildSeconds+(fastBuild-c.lowSpeedSteeringBuildSeconds)*roadBlend;
 if(steer){const step=dt/buildSeconds;b.steering+=Math.max(-step,Math.min(step,steer-b.steering));}
 else b.steering*=Math.exp(-c.steeringReleasePerSecond*dt);
 const maxYaw=Math.min(c.maxYawRadiansPerSecond,c.lateralAccelerationMetersPerSecondSquared/Math.max(1,absoluteSpeed),absoluteSpeed/c.wheelbaseMeters*Math.tan(c.steeringRadians));
 // Low-speed bicycle geometry gives tight steering without commanding a
 // large lean. At speed, retain progressive lateral-acceleration demand.
 const lowRate=-speed/c.wheelbaseMeters*Math.tan(b.steering*c.lowSpeedSteeringRadians);
 const requestedRate=lowRate*(1-roadBlend)-Math.sign(speed)*b.steering*maxYaw*roadBlend;
 const targetLean=Math.max(-c.maxLeanRadians,Math.min(c.maxLeanRadians,Math.atan(speed*requestedRate/c.gravityMetersPerSecondSquared)));
 b.cornerLean??=b.lean||0;
 b.cornerLean+=(targetLean-b.cornerLean)*(1-Math.exp(-c.leanResponsePerSecond*dt));
 // Low-speed rider balance is represented visually without widening the turn.
 b.lean=b.cornerLean*(c.lowSpeedVisibleLeanScale+(1-c.lowSpeedVisibleLeanScale)*roadBlend);
 // At road speed, banking and trajectory develop together instead of the
 // chassis turning first and the visible lean chasing it afterward.
 const bankRate=absoluteSpeed>.01?c.gravityMetersPerSecondSquared*Math.tan(b.cornerLean)/speed:0;
 const rate=lowRate*(1-roadBlend)+bankRate*roadBlend;
 const midYaw=b.yaw+rate*dt/2,nextYaw=b.yaw+rate*dt;
 const next={x:b.x-Math.sin(midYaw)*speed*dt/C.cellMeters,z:b.z-Math.cos(midYaw)*speed*dt/C.cellMeters};
 const contact=clear(b,next);
 if(contact!==true){
  const velocity={x:-Math.sin(midYaw)*speed,z:-Math.cos(midYaw)*speed};
  const normal=contact?.normal??{x:Math.sin(midYaw),z:Math.cos(midYaw)};
  const length=Math.hypot(normal.x,normal.z)||1,nx=normal.x/length,nz=normal.z/length;
  const dot=velocity.x*nx+velocity.z*nz,impact=Math.abs(dot);
  b.roadHealth??=1;
  if(impact>c.damageThresholdMetersPerSecond)b.roadHealth=Math.max(0,b.roadHealth-.7*((impact-c.damageThresholdMetersPerSecond)/(c.fatalImpactMetersPerSecond-c.damageThresholdMetersPerSecond))**2);
  b.lastRoadImpact=impact;b.boosting=false;
  if(impact>=c.fatalImpactMetersPerSecond||b.roadHealth<=0){b.roadHealth=0;b.roadSpeed=0;b.alive=false;return false;}
  const vx=(velocity.x-dot*nx)*c.impactTangentialRetention-dot*nx*c.impactRestitution;
  const vz=(velocity.z-dot*nz)*c.impactTangentialRetention-dot*nz*c.impactRestitution;
  b.roadSpeed=Math.hypot(vx,vz);
  if(b.roadSpeed<.5)b.roadSpeed=0;
  if(b.roadSpeed>0)b.yaw=Math.atan2(-vx,-vz);
  b.previousX=b.x;b.previousZ=b.z;b.progress=1;b.steering=0;
  b.lean*=Math.exp(-c.leanResponsePerSecond*dt);b.cornerLean=b.lean;
  b.speedMultiplier=Math.abs(b.roadSpeed)/C.speedMetersPerSecond;
  return true;
 }
 b.previousX=b.x;b.previousZ=b.z;b.x=next.x;b.z=next.z;b.yaw=nextYaw;b.progress=1;
 b.speedMultiplier=Math.abs(b.roadSpeed)/C.speedMetersPerSecond;return true;
}
