import {surfaceImpact} from './surface-impact.js';
import {configFor,attachSettings} from '../game/config.js';
import {createActiveTeleportPads as createTeleportPads} from '../levels/teleporters.js';
import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
import {updateHearing} from './hearing.js';
import {TELEPORT_PADS,updateTeleporters} from './teleporters.js';
import {updateReinforcements} from './reinforcements.js';
import {createCarrierSearch,updateCarrierSearch} from './carrier-search.js';
import {createDataBeams,beginDataTransfer,collectData} from './data-beams.js';
import {applyPartDamage} from './part-damage.js';
import {enemyHitPart,recordEnemyHit} from './hit-parts.js';
import {randomSeed,seededRandom} from '../game/random.js';
import {updateMouseAim,accelerateMouseAim} from './mouse-aim.js';
import {stabilizeTurret} from './turret.js';
import {createGroundTanks,updateGroundTanks,reactToGroundHit} from './ground-tanks.js';
import {intercept} from './intercept.js';
import { TANK } from '../game/tank.js';
import { config, CLU_HEALTH, CLU_WEAPON, GUNNER, gunnerAimScale, TURBO, RECOGNIZER_SCALE, clamp, damp, angleDelta } from '../game/config.js';
import { createRecognizers, updateRecognizers, perceive } from './recognizers.js';

export function createRun(seed=randomSeed(),world=DEFAULT_WORLD,settings=null) {
  const config=settings?.vehicle||configFor(null);
  const {SPAWN}=world;
  const random=seededRandom(seed);
  const run={...SPAWN,seed,inspection:false,teleportPads:createTeleportPads(world.MAZE_INSTANCES,world.WALL_HEIGHT),teleport:null,teleportArrival:null,teleportRevision:0,pursuitSeconds:0,reinforcementsSpawned:0,cruiseThrottle:false,gunner:false,mouseAim:null,turretLocked:false,gunnerLeveling:false,gunnerYawMotion:0,gunnerPitchMotion:0,gunnerZoom:GUNNER.minZoom,aimPitch:0,turretYaw:0,turretHeading:null,turretCentering:false,turboRemaining:0,turboCooldown:0,speed:0,steer:0,time:0,impact:0,status:'running',
    carrierHealth:100,carrierHitAt:-Infinity,transferActive:false,carrierSearch:createCarrierSearch(),dataBeams:createDataBeams(random,world),dataCollected:0,enemyTanks:createGroundTanks(random,world,config),health:CLU_HEALTH.max,won:false,crushed:false,cooldown:0,extraShots:CLU_WEAPON.maxExtraShots,shotRest:0,fireWasDown:false,recoil:0,shots:0,kills:0,projectiles:[],events:[],recognizers:createRecognizers(random,world),radio:[]};
  if(config.aiMode!=='classic'&&config.aiSmallEncounter){run.recognizers=run.recognizers.slice(0,2);run.enemyTanks=run.enemyTanks.filter(e=>e.role==='patrol'&&e.mazeId===0).slice(0,1);if(run.enemyTanks[0])Object.assign(run.enemyTanks[0],{id:100,index:0});}
  run.scenario={...world.spec,runSeed:seed,configuration:settings?structuredClone(settings):null};
  if(settings){attachSettings(run,settings);for(const e of [...run.recognizers,...run.enemyTanks])attachSettings(e,settings);}
  return attachWorld(run,world);
}

export function boostTank(run){
  if(run.crushed||run.teleport||run.transferActive||run.turboRemaining>0)return false;
  const available=TURBO.duration*clamp(1-run.turboCooldown/TURBO.rechargeSeconds,0,1);
  if(available<=1e-8)return false;
  run.turboRemaining=available;run.turboCooldown=TURBO.rechargeSeconds;
  return true;
}

// Opening pursuit is a real initial sighting, not a scripted tracking target.
export function startPursuit(run){
 const config=configFor(run);
  const forward={x:-Math.sin(run.yaw),s:Math.cos(run.yaw)};
  for(const [i,side,behind] of [[0,-340,320],[1,-170,310],[2,0,300],[3,170,310],[4,340,320]]){
    const e=run.recognizers[i];if(!e)continue;
    Object.assign(e,{x:run.x-forward.x*behind+Math.cos(run.yaw)*side,
      s:run.s-forward.s*behind+Math.sin(run.yaw)*side,yaw:run.yaw,
      vx:forward.x*config.enemySpeed,vs:forward.s*config.enemySpeed,nextSense:0});
    perceive(e,run,run.time);
    if(e.canSee)e.state='pursue';
  }
}

// Sweep in substeps smaller than the hull radius, with circle/box wall sliding.
export function moveTank(run,dx,ds) {
 const config=configFor(run);
 const {nearbyWalls,insideWall,closestWallPoint}=worldFor(run);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,ds)/.45)),radius=config.tankRadius;
  let hit=false;
  for(let i=0;i<steps;i++) {
    const oldX=run.x,oldS=run.s;run.x+=dx/steps;run.s+=ds/steps;
    if(run.enemyTanks?.some(e=>!e.teleport&&e.state!=='destroyed'&&Math.hypot(e.x-run.x,e.s-run.s)<radius*2)){run.x=oldX;run.s=oldS;hit=true;continue;}
    for(let pass=0;pass<3;pass++)for(const w of nearbyWalls(run.x,run.s,radius)) {
      const point=closestWallPoint(w,run.x,run.s),inside=insideWall(w,run.x,run.s);
      if(!inside&&point.distance>=radius)continue;
      hit=true;
      if(inside){run.x=point.x+point.nx*(radius+1e-6);run.s=point.s+point.ns*(radius+1e-6);}
      else if(point.distance>1e-8){run.x+=(run.x-point.x)/point.distance*(radius-point.distance+1e-6);run.s+=(run.s-point.s)/point.distance*(radius-point.distance+1e-6);}

    }
  }
  return hit;
}

// Match the current model adapter's turret pivot and level muzzle in meters.
export function cannonPose(run) {
  const yaw = run.yaw + run.turretYaw;
  const mx=TANK.muzzle[0]-TANK.pivot[0], mz=TANK.muzzle[2]-TANK.pivot[2];
  const tx = Math.cos(run.turretYaw) * mx + Math.sin(run.turretYaw) * mz;
  const tz = -Math.sin(run.turretYaw) * mx + Math.cos(run.turretYaw) * mz;
  const bx = TANK.pivot[0] + tx, bz = TANK.pivot[2] + tz;
  return {x:run.x + Math.cos(run.yaw)*bx + Math.sin(run.yaw)*bz,
    s:run.s + Math.sin(run.yaw)*bx - Math.cos(run.yaw)*bz, y:TANK.muzzle[1], yaw};
}

export function cannonTarget(run) {
 const {lineOfSight}=worldFor(run);
  const pose=cannonPose(run);
  if(run.gunner)return {manual:true,lock:false,id:null,distance:160,x:pose.x-Math.sin(pose.yaw)*Math.cos(run.aimPitch)*160,s:pose.s+Math.cos(pose.yaw)*Math.cos(run.aimPitch)*160,y:pose.y+Math.sin(run.aimPitch)*160};
  let best=null;
  for(const e of [...run.recognizers,...run.enemyTanks]) {
    if(e.teleport||e.state==='destroyed'||e.state==='materializing')continue;
    const targetY=e.kind==='ground'?2.3:e.y+1;
    const dx=e.x-pose.x,ds=e.s-pose.s,distance=Math.hypot(dx,ds);
    const error=Math.abs(angleDelta(pose.yaw,-Math.atan2(dx,ds)));
    if(distance>CLU_WEAPON.assistRange||error>=Math.min(.4,Math.atan2(e.kind==='ground'?3.5:18*RECOGNIZER_SCALE,Math.max(1,distance))))continue;
    if(!lineOfSight(pose,{x:e.x,s:e.s,y:targetY}))continue;
    const aim=intercept(pose,{x:e.x,s:e.s,y:targetY},{x:e.vx,y:e.vy,s:e.vs},CLU_WEAPON.speed,CLU_WEAPON.lifetime);
    if(!aim||!lineOfSight(pose,aim))continue;
    if(Math.atan2(aim.y-pose.y,Math.hypot(aim.x-pose.x,aim.s-pose.s))>GUNNER.maxPitch)continue;
    if(!best||error<best.error)best={...aim,id:e.id,distance,error,lock:true};
  }
  return best||{id:null,x:pose.x-Math.sin(pose.yaw)*160,s:pose.s+Math.cos(pose.yaw)*160,y:pose.y,distance:160,lock:false};
}

export function updateWeapons(run,input,dt) {
 const {wallIntersection,lineOfSight}=worldFor(run);
  for(const e of run.recognizers)e.hit=Math.max(0,e.hit-dt*4);
  run.cooldown=Math.max(0,run.cooldown-dt);run.recoil=Math.max(0,run.recoil-dt*4);
  if(!run.crushed&&run.extraShots<CLU_WEAPON.maxExtraShots){
    run.shotRest+=dt;
    while(run.shotRest+1e-8>=CLU_WEAPON.reserveRecharge&&run.extraShots<CLU_WEAPON.maxExtraShots){
      run.extraShots++;
      run.shotRest=Math.max(0,run.shotRest-CLU_WEAPON.reserveRecharge);
    }
  }
  if(run.extraShots>=CLU_WEAPON.maxExtraShots)run.shotRest=0;
  // Held fire keeps its normal cadence; fresh presses can spend stored shots.
  const pressed=input.firePressed??(input.fire&&!run.fireWasDown);
  run.fireWasDown=!!input.fire;
  const spendExtra=run.cooldown>0&&pressed&&run.extraShots>0;
  if(!run.crushed&&!run.teleport&&input.fire&&(run.cooldown<=0||spendExtra)) {
    if(spendExtra)run.extraShots--;
    run.shotRest=0;
    const target=cannonTarget(run),pose=cannonPose(run),{x,s,y,yaw}=pose;
    const distance=target.lock?Math.max(1,target.distance):160;
    let dx=(target.lock||target.manual)?target.x-x:-Math.sin(yaw)*distance,ds=(target.lock||target.manual)?target.s-s:Math.cos(yaw)*distance;
    let dy=target.y-y;
    if(!run.gunner&&target.lock){
      // Independent per-shot randomness preserves seeded encounters. Spread never
      // points below the horizon; an unassisted level shot stays exactly level.
      const random=seededRandom((run.seed^Math.imul(run.shots+1,2654435761))>>>0);
      const yawSpread=CLU_WEAPON.assistYawSpread;
      const pitchSpread=CLU_WEAPON.assistPitchSpread;
      const shotYaw=-Math.atan2(dx,ds)+(random()*2-1)*yawSpread;
      const pitch=Math.atan2(dy,Math.hypot(dx,ds));
      const shotPitch=clamp(pitch+(Math.abs(pitch)>1e-8?(random()*2-1)*pitchSpread:0),GUNNER.minPitch,GUNNER.maxPitch);
      dx=-Math.sin(shotYaw)*Math.cos(shotPitch);ds=Math.cos(shotYaw)*Math.cos(shotPitch);dy=Math.sin(shotPitch);
    }
    const length=Math.hypot(dx,ds,dy);
    // A muzzle poking into a wall cannot fire through it.
    if(lineOfSight({x:run.x,s:run.s,y},pose))run.projectiles.push({x,s,y,vx:dx/length*CLU_WEAPON.speed,vs:ds/length*CLU_WEAPON.speed,vy:dy/length*CLU_WEAPON.speed,life:CLU_WEAPON.lifetime});
    run.cooldown=CLU_WEAPON.recharge;run.recoil=1;run.shots++;run.events.push({type:'shot',x,y,s});
  }
  for(const p of run.projectiles) {
    const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vs,p.vy)*dt/.8));
    for(let i=0;i<steps&&p.life>0;i++) {
      const next={x:p.x+p.vx*dt/steps,s:p.s+p.vs*dt/steps,y:p.y+p.vy*dt/steps};
      const surface=surfaceImpact(worldFor(run),p,next);
      if(surface){run.events.push(surface);p.life=0;break;}
      const shotFrom={x:p.x,y:p.y,z:-p.s};
      Object.assign(p,next);
      if(p.faction==='enemy'){
        if(run.enemyTanks.some(e=>e.id!==p.owner&&!e.teleport&&e.state!=='destroyed'&&Math.hypot(p.x-e.x,p.s-e.s)<3.5&&p.y<3.5)){p.life=0;continue;}
        if(!run.crushed&&!run.teleport&&Math.hypot(p.x-run.x,p.s-run.s)<3.5&&p.y<3.5){
          p.life=0;if(run.inspection)continue;run.health=Math.max(0,run.health-1);run.impact=1;run.events.push({type:'hit',subject:'tank',shotFrom,fatal:run.health<=0,x:p.x,y:p.y,s:p.s});
          if(run.health<=0){const speed=run.speed;run.crushed=true;run.speed=0;run.events.push({type:'destroyed',subject:'tank',x:run.x,y:0,s:run.s,yaw:run.yaw,turretYaw:run.turretYaw,vx:-Math.sin(run.yaw)*speed,vs:Math.cos(run.yaw)*speed,hit:{x:p.x,y:p.y,z:-p.s}});}
        }
        continue;
      }
      for(const e of [...run.recognizers,...run.enemyTanks]) {
        if(e.teleport||e.state==='destroyed'||e.state==='materializing')continue;
        const hitPart=enemyHitPart(e,p);
        if(hitPart) {
          recordEnemyHit(e,p,hitPart,run.time);
          const {critical,damage}=applyPartDamage(e,hitPart);e.hit=1;p.life=0;
          if(e.kind==='ground'&&e.health>0)reactToGroundHit(e,p,run.time);run.events.push({type:'hit',subject:e.kind==='ground'?'enemyTank':'recognizer',id:e.id,shotFrom,hitPart,critical,damage,fatal:e.health===0,x:p.x,y:p.y,s:p.s});
          if(e.health===0){e.state='destroyed';e.canSee=false;e.memory=null;run.kills++;run.events.push({type:'destroyed',subject:e.kind==='ground'?'enemyTank':undefined,turretYaw:e.turretYaw,id:e.id,hitPart,critical,x:e.x,y:e.kind==='ground'?0:e.y,s:e.s,yaw:e.yaw,fold:e.fold||0,vx:e.vx,vy:e.vy,vs:e.vs,hit:{x:p.x,y:p.y,z:-p.s}});}
          break;
        }
      }
    }
    p.life-=dt;
  }
  run.projectiles=run.projectiles.filter(p=>p.life>0);
}

export function step(run,input,dt) {
 if(run.won)return;
 const config=configFor(run);
  if(run.crushed){run.gunnerLeveling=false;run.gunnerYawMotion=0;run.gunnerPitchMotion=0;run.cruiseThrottle=false;input={};run.speed=0;run.steer=0;run.turretCentering=false;run.turboRemaining=0;}
  updateTeleporters(run);updateHearing(run);
  if(run.teleport){input={};run.speed=0;run.steer=0;run.cruiseThrottle=false;run.gunnerYawMotion=0;run.gunnerPitchMotion=0;run.turretCentering=false;run.turretLocked=false;}
  if(!run.teleport)beginDataTransfer(run);
  if(run.transferActive&&!run.crushed){input={...input,throttle:0,steer:0};run.speed=0;run.steer=0;run.turboRemaining=0;run.cruiseThrottle=false;}
  run.turboCooldown=run.turboCooldown<=dt+1e-8?0:run.turboCooldown-dt;
  run.time+=dt;run.impact=Math.max(0,run.impact-dt*2.5);
  const hullYawBefore=run.yaw,aimScale=run.gunner?gunnerAimScale(run.gunnerZoom):1;
  const turretInput=clamp(input.turret||0,-1,1),pitchInput=clamp(input.aimPitch||0,-1,1);
  const manualAim=turretInput||pitchInput||input.mouseTarget;
  if(manualAim){
    if(run.turretLocked){run.turretCentering=false;run.gunnerLeveling=false;}
    run.turretLocked=false;
    if(input.mouseTarget){run.turretCentering=false;run.gunnerLeveling=false;}
  }
  if(pitchInput)run.gunnerLeveling=false;
  if(turretInput)run.turretCentering=false;
  const centering=run.turretCentering||run.turretLocked,leveling=run.gunnerLeveling||run.turretLocked;
  const yawBefore=angleDelta(0,run.turretYaw),pitchBefore=run.aimPitch;
  const mouseAim=updateMouseAim(run,input,aimScale);
  const yawCommand=centering?Math.sign(yawBefore):mouseAim?.yaw??turretInput;
  const pitchCommand=leveling?-Math.sign(pitchBefore):mouseAim?.pitch??pitchInput;
  let yawMotion=yawCommand,pitchMotion=pitchCommand;
  if(run.gunner){
    const ease=(current,target)=>{const value=damp(current||0,target,target?GUNNER.aimResponse:GUNNER.aimBrakeResponse,dt);return !target&&Math.abs(value)<.0001?0:value;};
    run.gunnerYawMotion=mouseAim?accelerateMouseAim(run.gunnerYawMotion,yawCommand,dt):ease(run.gunnerYawMotion,yawCommand);
    run.gunnerPitchMotion=mouseAim?accelerateMouseAim(run.gunnerPitchMotion,pitchCommand,dt):ease(run.gunnerPitchMotion,pitchCommand);
    yawMotion=run.gunnerYawMotion;pitchMotion=run.gunnerPitchMotion;
  }else{run.gunnerYawMotion=0;run.gunnerPitchMotion=0;}
  let yawStep=yawMotion*config.turretSpeed*dt*aimScale;
  const worldHeading=hullYawBefore+yawBefore;
  if(run.turretHeading==null||run.crushed)run.turretHeading=worldHeading;
  // Input steers from the actual sight, avoiding queued rotation when the motor saturates.
  if(!centering&&yawMotion!==0)run.turretHeading=worldHeading-yawStep;
  if(centering&&(yawBefore===0||yawBefore*yawStep>0&&Math.abs(yawStep)>=Math.abs(yawBefore))){
    run.turretYaw=0;run.turretCentering=false;run.gunnerYawMotion=0;
  }else run.turretYaw=angleDelta(0,yawBefore-yawStep);
  if(run.gunner||leveling){
    let pitchStep=pitchMotion*GUNNER.pitchRate*dt*aimScale;
    if(leveling&&(pitchBefore===0||pitchBefore*pitchStep<0&&Math.abs(pitchStep)>=Math.abs(pitchBefore))){
      run.aimPitch=0;run.gunnerLeveling=false;run.gunnerPitchMotion=0;
    }else{
      const pitch=pitchBefore+pitchStep;
      run.aimPitch=clamp(pitch,GUNNER.minPitch,GUNNER.maxPitch);
      if(pitch!==run.aimPitch)run.gunnerPitchMotion=0;
    }
  }
  if(input.turbo&&input.throttle>0)boostTank(run);
  const boosting=run.turboRemaining>0,previousSpeed=run.speed;
  const speedLimit=config.maxSpeed*(boosting?TURBO.speedMultiplier:1);
  const throttle=input.throttle||0;
  if(throttle<0)run.cruiseThrottle=false;
  const acceleration=config.acceleration*(boosting?TURBO.accelerationMultiplier:1);
  run.turboRemaining=run.turboRemaining<=dt+1e-8?0:run.turboRemaining-dt;
  if(throttle>0)run.speed+=(run.speed<0?config.braking:acceleration)*dt;
  else if(throttle<0)run.speed-=(run.speed>0?config.braking:acceleration*.6)*dt;
  else run.speed=Math.sign(run.speed)*Math.max(0,Math.abs(run.speed)-config.drag*dt);
  // Ease back to cruise speed at the end instead of snapping downward.
  const limit=boosting?speedLimit:Math.max(speedLimit,previousSpeed-config.braking*dt);
  const reverseLimit=boosting?speedLimit*TURBO.reverseRatio:Math.max(config.reverseSpeed,-previousSpeed-config.braking*dt);
  run.speed=clamp(run.speed,-reverseLimit,limit);
  run.steer=damp(run.steer,input.steer||0,8,dt);
  const turnFactor=.65+.35*(1-Math.min(1,Math.abs(run.speed)/config.maxSpeed));
  run.yaw-=run.steer*config.steering*turnFactor*(run.speed<-.5?-1:1)*dt;
  if(centering)run.turretHeading=run.yaw+run.turretYaw;
  else{
    run.turretYaw=yawBefore;
    stabilizeTurret(run,run.turretHeading,config.turretSpeed,dt);
  }
  const beforeX=run.x,beforeS=run.s;
  if(moveTank(run,-Math.sin(run.yaw)*run.speed*dt,Math.cos(run.yaw)*run.speed*dt)) {
    const travel=Math.hypot(run.x-beforeX,run.s-beforeS);
    const lostSpeed=Math.max(0,Math.abs(run.speed)-travel/dt);
    if(lostSpeed>2)run.impact=Math.max(run.impact,Math.min(1,lostSpeed/14));
    // Preserve tangential travel; only stop drive speed when actually blocked.
    // This also allows immediate reverse instead of braking stored wall pressure.
    if(travel<Math.abs(run.speed)*dt*.05)run.speed=0;
  }
  updateCarrierSearch(run,dt);updateRecognizers(run,dt);updateReinforcements(run,dt);updateGroundTanks(run,dt,moveTank,cannonPose);updateWeapons(run,input,dt);collectData(run,dt);updateTeleporters(run);updateHearing(run);
  if(run.crushed)run.health=0;
  else if(run.health>0&&run.health<CLU_HEALTH.max)run.health=Math.min(CLU_HEALTH.max,run.health+CLU_HEALTH.max*dt/CLU_HEALTH.rechargeSeconds);
}

/** Resume the outside world without advancing the tank controller or objectives. */
export function stepCycleWorld(run,dt){
 updateHearing(run);
 updateCarrierSearch(run,dt);updateRecognizers(run,dt);updateReinforcements(run,dt);
 updateGroundTanks(run,dt,moveTank,cannonPose);updateWeapons(run,{},dt);updateHearing(run);
}
