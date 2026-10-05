// Double turret Clu Light Tank: uniform 6.5 m hull width, Y-up, -Z forward.
export const BOSS_TANK=Object.freeze({
 count:4,courtInnerRadiusMeters:100,courtOuterRadiusMeters:230,
 health:12,normalHealth:3,speedMultiplier:.8,
 scale:6.5/(.07995702373578287+.07995700823285372),
 sourceCenterZ:(-.09561913696595892+.12177490388750008)/2,
 sourceFloor:.000001500151693356027,
 pivot:[0,1.95,.5316],
 hullHalfWidthMeters:3.25,hullHalfLengthMeters:4.45,hullHeightMeters:2,
 turretMinHeightMeters:1.55,turretMaxHeightMeters:2.8,turretHalfWidthMeters:2.8,turretFrontMeters:-6.3,turretRearMeters:3.5,
 muzzles:[[-2.065,1.952,-5.661],[2.065,1.952,-5.661]],
});
export function bossMuzzlePoses(tank){
 return BOSS_TANK.muzzles.map(muzzle=>{
  const [px,,pz]=BOSS_TANK.pivot,mx=muzzle[0]-px,mz=muzzle[2]-pz;
  const tx=px+Math.cos(tank.turretYaw)*mx+Math.sin(tank.turretYaw)*mz;
  const tz=pz-Math.sin(tank.turretYaw)*mx+Math.cos(tank.turretYaw)*mz;
  return {x:tank.x+Math.cos(tank.yaw)*tx+Math.sin(tank.yaw)*tz,
   s:tank.s+Math.sin(tank.yaw)*tx-Math.cos(tank.yaw)*tz,y:muzzle[1],yaw:tank.yaw+tank.turretYaw};
 });
}

export function inBossCourt(point,maze){
 const center=maze.beamPosition??maze,radius=Math.hypot(point.x-center.x,point.s-center.s);
 return radius>=BOSS_TANK.courtInnerRadiusMeters&&radius<=BOSS_TANK.courtOuterRadiusMeters;
}

export function bossCourtSector(point,maze){
 const center=maze.beamPosition??maze;
 const angle=(Math.atan2(point.s-center.s,point.x-center.x)+Math.PI*2)%(Math.PI*2);
 return Math.floor(angle/(Math.PI*2)*BOSS_TANK.count);
}
