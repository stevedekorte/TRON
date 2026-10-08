import {TANK} from '../game/tank.js';
import {angleDelta} from '../game/config.js';
import {worldFor} from '../levels/scenario.js';

export const TURRET_CONTACT=Object.freeze({barrelRadiusMeters:.32,turretRadiusMeters:1.25,sampleStepMeters:.2,sweepStepMeters:.15,damageSpeedMetersPerSecond:30,lodgeSpeedMetersPerSecond:40,lodgeAlignment:.75,embedDepthMeters:.45,extractSeconds:8,damageCooldownSeconds:.6});
export const tankContactPose=run=>({x:run.x,s:run.s,yaw:run.yaw,turretYaw:run.turretYaw});
function point(p,x,z,y){return {x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,s:p.s+Math.sin(p.yaw)*x-Math.cos(p.yaw)*z,y};}
export function turretSegment(p){
 const [px,py,pz]=TANK.pivot,[mx,my,mz]=TANK.muzzle,co=Math.cos(p.turretYaw),si=Math.sin(p.turretYaw);
 return [point(p,px,pz,py),point(p,px+co*(mx-px)+si*(mz-pz),pz-si*(mx-px)+co*(mz-pz),my)];
}
export function turretWallContact(world,p){
 const [a,b]=turretSegment(p),length=Math.hypot(b.x-a.x,b.s-a.s),steps=Math.ceil(length/TURRET_CONTACT.sampleStepMeters);
 const reach=Math.max(Math.hypot(a.x-p.x,a.s-p.s),Math.hypot(b.x-p.x,b.s-p.s))+TURRET_CONTACT.turretRadiusMeters;
 const walls=world.nearbyWalls(p.x,p.s,reach);
 if(!walls.length)return null;
 let deepest=null;
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=a.x+(b.x-a.x)*t,s=a.s+(b.s-a.s)*t,y=a.y+(b.y-a.y)*t;
  const radius=i===0?TURRET_CONTACT.turretRadiusMeters:TURRET_CONTACT.barrelRadiusMeters;
  for(const wall of walls){
   if(y-radius>wall.height)continue;
   const q=world.closestWallPoint(wall,x,s),inside=world.insideWall(wall,x,s);
   const penetration=inside?radius+q.distance:radius-q.distance;
   if(penetration<=1e-6||deepest&&penetration<=deepest.penetration)continue;
   deepest={x:q.x,s:q.s,y,normal:{x:q.nx,y:0,z:-q.ns},penetration,muzzle:t>.9};
  }
 }
 return deepest;
}
export function damageWallFromTank(run,contact,speed){
 if(!contact||speed<TURRET_CONTACT.damageSpeedMetersPerSecond||run.time<(run.nextWallRamAt??-Infinity))return;
 run.nextWallRamAt=run.time+TURRET_CONTACT.damageCooldownSeconds;
 run.events.push({type:'hit',subject:'surface',x:contact.x,s:contact.s,y:contact.y,normal:contact.normal,source:'tank-impact'});
 run.impact=Math.max(run.impact,Math.min(1,speed/55));
}
export function resolveTurretMotion(run,before,dt){
 const world=worldFor(run),after=tankContactPose(run),yaw=angleDelta(before.yaw,after.yaw),turret=angleDelta(before.turretYaw,after.turretYaw);
 const travel=Math.hypot(after.x-before.x,after.s-before.s)+10*(Math.abs(yaw)+Math.abs(turret));
 const steps=Math.max(1,Math.ceil(travel/TURRET_CONTACT.sweepStepMeters));
 let safe=before,oldContact=turretWallContact(world,before);
 for(let i=1;i<=steps;i++){
  const t=i/steps,p={x:before.x+(after.x-before.x)*t,s:before.s+(after.s-before.s)*t,yaw:before.yaw+yaw*t,turretYaw:before.turretYaw+turret*t};
  const contact=turretWallContact(world,p);
  // Existing overlaps (e.g. a development placement) may move out, not deeper.
  if(contact&&(!oldContact||contact.penetration>oldContact.penetration+1e-6)){
   const [oldPivot,oldMuzzle]=turretSegment(before),[,newMuzzle]=turretSegment(after);
   const normal=contact.normal;
   const impactSpeed=Math.max(0,-((newMuzzle.x-oldMuzzle.x)*normal.x-(newMuzzle.s-oldMuzzle.s)*normal.z)/dt);
   // Block motion into the wall but preserve sliding along its face.
   const dx=after.x-safe.x,ds=after.s-safe.s,into=Math.min(0,dx*normal.x-ds*normal.z);
   const slideX=dx-into*normal.x,slideS=ds+into*normal.z;
   let slide=safe;
   const slideSteps=Math.max(1,Math.ceil(Math.hypot(slideX,slideS)/TURRET_CONTACT.sweepStepMeters));
   const safeDepth=turretWallContact(world,safe)?.penetration??0;
   for(let j=1;j<=slideSteps;j++){
    const candidate={...safe,x:safe.x+slideX*j/slideSteps,s:safe.s+slideS*j/slideSteps};
    if((turretWallContact(world,candidate)?.penetration??0)>safeDepth+1e-6)break;
    slide=candidate;
   }
   const moved=Math.hypot(slide.x-before.x,slide.s-before.s),wanted=Math.hypot(after.x-before.x,after.s-before.s);
   Object.assign(run,slide);if(moved<Math.max(.001,wanted*.05))run.speed=0;run.steer=0;run.turretHeading=run.yaw+run.turretYaw;run.gunnerYawMotion=0;
   damageWallFromTank(run,contact,impactSpeed);
   const length=Math.hypot(oldMuzzle.x-oldPivot.x,oldMuzzle.s-oldPivot.s);
   const alignment=-((oldMuzzle.x-oldPivot.x)*normal.x-(oldMuzzle.s-oldPivot.s)*normal.z)/length;
   if(contact.muzzle&&impactSpeed>=TURRET_CONTACT.lodgeSpeedMetersPerSecond&&alignment>=TURRET_CONTACT.lodgeAlignment){
    run.speed=0;run.steer=0;
    run.barrelJam={safe:{...safe},normal:{...normal},remaining:TURRET_CONTACT.extractSeconds};
    run.x-=normal.x*TURRET_CONTACT.embedDepthMeters;run.s+=normal.z*TURRET_CONTACT.embedDepthMeters;
    run.events.push({type:'barrelLodged'});
   }
   return true;
  }
  safe=p;oldContact=contact;
 }
 return false;
}
export function holdLodgedTurret(run,input,dt){
 const jam=run.barrelJam;if(!jam)return false;
 if(input.throttle<0)jam.remaining=Math.max(0,jam.remaining-dt);
 Object.assign(run,jam.safe);
 const depth=TURRET_CONTACT.embedDepthMeters*jam.remaining/TURRET_CONTACT.extractSeconds;
 run.x-=jam.normal.x*depth;run.s+=jam.normal.z*depth;
 run.speed=0;run.steer=0;run.cruiseThrottle=false;run.turboRemaining=0;run.turretHeading=run.yaw+run.turretYaw;run.gunnerYawMotion=0;
 if(jam.remaining===0){run.barrelJam=null;run.events.push({type:'barrelFreed'});}
 return true;
}
