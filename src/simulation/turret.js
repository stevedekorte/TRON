import {angleDelta,clamp} from '../game/config.js';

// All yaw motion—including hull compensation—uses this single motor budget.
export function stabilizeTurret(tank,heading,maxRate,dt){
 const desired=angleDelta(tank.yaw,heading);
 tank.turretYaw=angleDelta(0,tank.turretYaw+clamp(angleDelta(tank.turretYaw,desired),-maxRate*dt,maxRate*dt));
}
