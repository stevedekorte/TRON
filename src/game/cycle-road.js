export const ROAD_CYCLE=Object.freeze({
 cruiseResponsePerSecond:2,brakeResponsePerSecond:4,
 reverseSpeedMetersPerSecond:3,reverseAccelerationMetersPerSecondSquared:4,reverseReleaseDecelerationMetersPerSecondSquared:8,
 stopSpeedMetersPerSecond:.25,fatalImpactMetersPerSecond:18,damageThresholdMetersPerSecond:2,
 impactRestitution:.15,impactTangentialRetention:.8,
 maxSpeedMetersPerSecond:55,accelerationMetersPerSecondSquared:8,
 brakeMetersPerSecondSquared:36,rollingDragMetersPerSecondSquared:2,aeroDragPerMeter:.0012,
 wheelbaseMeters:2.1,steeringRadians:.5,
 lowSpeedVisibleLeanScale:.4,lowSpeedSteeringRadians:.45,lowSpeedSteeringBuildSeconds:.18,
 steeringBlendStartMetersPerSecond:3,steeringBlendEndMetersPerSecond:12,steeringBuildSeconds:.6,steeringSpeedScaleMetersPerSecond:35,steeringReleasePerSecond:5,
 turboAccelerationMultiplier:1.6,turboMaxSpeedMetersPerSecond:80,
 lateralAccelerationMetersPerSecondSquared:14,maxYawRadiansPerSecond:1.8,
 leanResponsePerSecond:10,maxLeanRadians:Math.PI/3,gravityMetersPerSecondSquared:9.81,
});

// [key, label, units, minimum, maximum, step]. Shared validation and UI ranges.
export const ROAD_CYCLE_FIELDS = Object.freeze({
 'Speed and pedals': [
  ['maxSpeedMetersPerSecond','Cruise speed limit','m/s',5,120,1],
  ['turboMaxSpeedMetersPerSecond','Turbo speed limit','m/s',5,180,1],
  ['accelerationMetersPerSecondSquared','Acceleration','m/s²',.5,40,.5],
  ['brakeMetersPerSecondSquared','Braking','m/s²',1,60,1],
  ['cruiseResponsePerSecond','Speed hold response','1/s',.1,12,.1],
  ['brakeResponsePerSecond','Braking response','1/s',.1,24,.1],
  ['turboAccelerationMultiplier','Turbo acceleration','×',1,4,.1],
  ['rollingDragMetersPerSecondSquared','Rolling drag','m/s²',0,10,.1],
  ['aeroDragPerMeter','Aerodynamic drag','1/m',0,.02,.0001],
 ],
 'Steering and lean': [
  ['wheelbaseMeters','Wheelbase','m',.5,5,.05],
  ['steeringRadians','High-speed steering limit','rad',.05,1.2,.01],
  ['lowSpeedSteeringRadians','Low-speed steering limit','rad',.05,1.2,.01],
  ['lowSpeedSteeringBuildSeconds','Low-speed input buildup','s',.02,1,.01],
  ['steeringBuildSeconds','Road input buildup','s',.05,3,.05],
  ['steeringSpeedScaleMetersPerSecond','Buildup speed scale','m/s',1,120,1],
  ['steeringReleasePerSecond','Steering release response','1/s',.2,20,.2],
  ['steeringBlendStartMetersPerSecond','Low-speed blend starts','m/s',0,30,.5],
  ['steeringBlendEndMetersPerSecond','Road blend completes','m/s',1,60,.5],
  ['lateralAccelerationMetersPerSecondSquared','Cornering acceleration limit','m/s²',1,35,.5],
  ['maxYawRadiansPerSecond','Yaw rate limit','rad/s',.1,5,.1],
  ['leanResponsePerSecond','Lean response','1/s',.5,30,.5],
  ['maxLeanRadians','Maximum lean','rad',.1,1.35,.01],
  ['lowSpeedVisibleLeanScale','Low-speed visible lean','×',0,1,.05],
 ],
 'Reverse and contact': [
  ['reverseSpeedMetersPerSecond','Reverse speed limit','m/s',.5,10,.5],
  ['reverseAccelerationMetersPerSecondSquared','Reverse acceleration','m/s²',.5,12,.5],
  ['reverseReleaseDecelerationMetersPerSecondSquared','Reverse release braking','m/s²',.5,20,.5],
  ['stopSpeedMetersPerSecond','Stop threshold','m/s',.01,1,.01],
  ['damageThresholdMetersPerSecond','Damage threshold','m/s',0,10,.5],
  ['fatalImpactMetersPerSecond','Fatal impact speed','m/s',1,60,1],
  ['impactRestitution','Impact bounce','×',0,1,.05],
  ['impactTangentialRetention','Contact sliding retention','×',0,1,.05],
 ],
});
export function validateRoadCycle(values){
 for(const [key,label,units,min,max] of Object.values(ROAD_CYCLE_FIELDS).flat()){
  if(!Number.isFinite(values[key])||values[key]<min||values[key]>max)throw new Error(`${label} must be ${min}–${max} ${units}.`);
 }
 if(values.gravityMetersPerSecondSquared!==ROAD_CYCLE.gravityMetersPerSecondSquared)throw new Error('Gravity stays at 9.81 m/s².');
 if(values.turboMaxSpeedMetersPerSecond<values.maxSpeedMetersPerSecond)throw new Error('Turbo speed must be at least the cruise speed limit.');
 if(values.steeringBlendEndMetersPerSecond<=values.steeringBlendStartMetersPerSecond)throw new Error('Road blend must complete above its starting speed.');
 if(values.fatalImpactMetersPerSecond<=values.damageThresholdMetersPerSecond)throw new Error('Fatal impact speed must exceed the damage threshold.');
 return values;
}

// Upgrade saved defaults without replacing custom handling settings.
export function migrateRoadCycleTuning(saved){
 const values={...saved};
 if(values.lowSpeedSteeringRadians===.65)values.lowSpeedSteeringRadians=ROAD_CYCLE.lowSpeedSteeringRadians;
 if(values.brakeResponsePerSecond===undefined&&values.brakeMetersPerSecondSquared===18)values.brakeMetersPerSecondSquared=ROAD_CYCLE.brakeMetersPerSecondSquared;
 return values;
}
