import {ARENA_WALL} from '../game/arena-breaches.js';
import {updateCycleOverview} from './cycle-overview.js';
import {cyclePlayerPose} from '../simulation/light-cycles.js';
import { FreeCamera } from './free-camera.js';
import * as THREE from 'three';
import { BeamCamera } from './beam-camera.js';
import { config, GUNNER, gunnerAimScale, FOLLOW_ZOOM, AERIAL_ZOOM } from '../game/config.js';
import { TANK } from '../game/tank.js';
import {CAMERA_CLEARANCE,clipCameraSegment,constrainCamera} from './camera-collision.js';
import {ARENA_CAMERA_WALL_HEIGHT,cycleCameraWorld,cycleCameraAnchor,cycleWallFollowPosition} from './arena-camera-collision.js';
const CYCLE_CAMERA=Object.freeze({distanceMeters:10,heightMeters:4,wallAnchorHeightMeters:7,lookAheadMeters:8,lookHeightMeters:1,closeLookNearMeters:2.5,closeLookFarMeters:7,responsePerSecond:8,glanceRadians:Math.PI*2/3,glanceResponsePerSecond:28,roadGlanceResponsePerSecond:4,turnLookRadians:Math.PI/5,turnLookResponsePerSecond:4,turnLookFullSpeedMetersPerSecond:5});
import {applyCycleOpening,cycleFormationBlend,CYCLE_FORMATION_CAMERA} from './cycle-opening.js';
export {CYCLE_OPENING} from './cycle-opening.js';
export const CYCLE_COCKPIT=Object.freeze({enterWallDistanceMeters:16,exitWallDistanceMeters:24,eyeHeightMeters:3,backMeters:2.5,sideMeters:2.5,lookHeightMeters:1,lookAheadMeters:5,responsePerSecond:10});
const WORLD_UP = new THREE.Vector3(0,1,0);
const CYCLE_GLANCE=Object.freeze({horizonPitchFovFraction:.25,followPitchFovFraction:.35});
const AERIAL_CAMERA = Object.freeze({
  transitionSeconds: 1.2,
  height: 600,
  distance: Math.hypot(180, 320),
});
const CYCLE_SWITCH_SECONDS=1.2;
export const CYCLE_DEATH_HOLD_SECONDS=3;
const GUNNER_TRANSITION_SECONDS = 0.75;
const IMPACT_SHAKE = Object.freeze({ pitch: 0.012, yaw: 0.009, roll: 0.006 });
const ENCOUNTER_FRAMING=Object.freeze({fadeOutAerialMix:.08});
const GUNNER_ZOOM_SECONDS = 0.35;
/** Owns camera modes and smoothing, but no scene/effect resources. */
export class CameraRig {
  constructor(world) {
    this.world = world;
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, 0.15, 2500);
    this.freeCamera = new FreeCamera(this.camera);
    this.aerial = false;
    this.aerialZoom = 1;
    this.aerialBlend = 0;
    this.beamCamera = new BeamCamera();
    this.followPosition = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.lookDesired = new THREE.Vector3();
    this.reducedMotion = false;
    this.reset();
  }
  reset() {
    if (this.freeCamera.active) this.freeCamera.exit();
    this.beamCamera.reset();
    this.beamCinematic = null;
    this.zoomTransition = null;
    this.zoomFov = undefined;
    this.zoomTarget = undefined;
    this.gunnerTransition = null;
    this.wasGunner = false;
    this.gunnerOpacity = 0;
    this.aerialBlend = 0;
    this.followZoom = 1;
    this.encounterFocus = 0;
    this.encounterPitch = undefined;
    this.freshCamera = true;
    this.collisionRecovery={active:false};
    this.cycleOpening = null;
    this.cycleOverview = null;
    this.cycleAnchor = null;
    this.cycleFollowedId=undefined;
    this.cycleDeathHold=null;
    this.cycleDeathsHeld=new Set();
    this.cycleSwitch=null;
    this.cycleGlanceInput = 0;
    this.cycleGlance = 0;
    this.cycleTurnLook = 0;
    this.cycleCockpit=false;
    this.cycleCockpitMix=0;
  }
  finishCycleOpening() {
    this.cycleOpening=null;
    this.freshCamera=true;
  }
  moveMouseAim(dx, dy, run) {
    if (!this.mouseLook) this.mouseLook = { yaw: run.yaw + run.turretYaw, pitch: run.aimPitch };
    const sensitivity = 0.0025 * gunnerAimScale(run.gunnerZoom);
    this.mouseLook.yaw -= dx * sensitivity;
    this.mouseLook.pitch = THREE.MathUtils.clamp(
      this.mouseLook.pitch - dy * sensitivity,
      GUNNER.minPitch,
      GUNNER.maxPitch,
    );
  }
  cluAerialFraming(modeAerialMix){
    const zoomMix=THREE.MathUtils.clamp((this.followZoom-FOLLOW_ZOOM.minScale)/(FOLLOW_ZOOM.maxScale-FOLLOW_ZOOM.minScale),0,1);
    const aerialAmount=this.aerialZoom<1?(this.aerialZoom-AERIAL_ZOOM.minScale)/(1-AERIAL_ZOOM.minScale):this.aerialZoom;
    const mix=THREE.MathUtils.lerp(zoomMix,THREE.MathUtils.clamp(aerialAmount,0,1),modeAerialMix);
    const scale=THREE.MathUtils.lerp(AERIAL_ZOOM.maxScale,Math.max(1,aerialAmount),modeAerialMix);
    return {mix,scale};
  }
  begin(run, dt, mode) {
    if (this.freeCamera.active) return this.frame = { cinematic: null, aerialMix: 1, preview: false, gunner: false };
    const cinematic = this.beamCamera.update(run, {
      yaw: run.yaw + run.turretYaw,
      blend: this.aerialBlend,
      transitionSeconds: AERIAL_CAMERA.transitionSeconds,
      turretSpeed: config.turretSpeed,
      reducedMotion: this.reducedMotion,
    });
    if (cinematic && !this.beamCinematic) {
      this.aerial = false;
      this.gunnerTransition = null;
      this.encounterPitch = undefined;
    }
    this.beamCinematic = cinematic;
    const aerialTarget = this.aerial ? 1 : 0;
    if (cinematic) this.aerialBlend = cinematic.blend;
    else if (this.reducedMotion) this.aerialBlend = aerialTarget;
    else
      this.aerialBlend += THREE.MathUtils.clamp(
        aerialTarget - this.aerialBlend,
        -(mode === 'paused' ? 0 : dt) / AERIAL_CAMERA.transitionSeconds,
        (mode === 'paused' ? 0 : dt) / AERIAL_CAMERA.transitionSeconds,
      );
    const aerialMix = THREE.MathUtils.smoothstep(this.aerialBlend, 0, 1);
    const preview = mode === 'ready',
      gunner = run.gunner && !cinematic && !run.crushed && !preview && this.opening == null;
    if (gunner !== !!this.wasGunner) {
      this.gunnerTransition =
        !this.reducedMotion && !cinematic && !preview && !run.crushed
          ? {
              position: this.camera.position.clone(),
              rotation: this.camera.quaternion.clone(),
              fov: this.camera.fov,
              x: run.x,
              s: run.s,
              opacity: this.gunnerOpacity || 0,
              elapsed: 0,
            }
          : null;
      this.wasGunner = gunner;
    }
    if (preview || run.crushed || this.reducedMotion) this.gunnerTransition = null;

    this.frame = { cinematic, aerialMix, preview, gunner };
    return this.frame;
  }
  update(run, previous, alpha, dt, mode, { x, s, yaw, turretYaw, fragments = [], cycleRace = run.cycleRace }) {
    if (this.freeCamera.active) return { tankVisible: run.playerVehicle!=='cycle' };
    if(run.playerVehicle==='cycle'){
      if(run.cycleSpectating){
        const watchedId=run.cycleFollowId??cycleRace.playerId;
        const watched=cycleRace.cycles.find(b=>b.id===watchedId);
        if(this.cycleDeathHold?.id!==watchedId)this.cycleDeathHold=null;
        if(watched&&!watched.alive&&!this.cycleDeathsHeld.has(watchedId)){
          this.cycleDeathsHeld.add(watchedId);
          this.cycleDeathHold={id:watchedId,elapsed:0};
          this.cycleSwitch=null;
        }
        if(this.cycleDeathHold){
          const hold=this.cycleDeathHold;
          if(hold.elapsed<CYCLE_DEATH_HOLD_SECONDS){
            hold.elapsed=Math.min(CYCLE_DEATH_HOLD_SECONDS,hold.elapsed+(mode==='paused'?0:dt));
            return {tankVisible:false};
          }
          // Automatic survivor selection runs in the application on the next
          // frame. Keep the crash view fixed until that selection happens.
          if(run.cycleFollowId!=null&&!watched?.alive)return {tankVisible:false};
        }
      }

      if(run.cycleSpectating&&run.cycleFollowId==null){this.cycleFollowedId=null;this.cycleSwitch=null;return updateCycleOverview(this,cycleRace,dt);}
      this.cycleOverview=null;
      const previousCamera=this.freshCamera?null:this.camera.position.clone();
      const followedId=run.cycleSpectating&&run.cycleFollowId!=null?run.cycleFollowId:cycleRace.playerId;
      const pose=cyclePlayerPose({...cycleRace,playerId:followedId});
      if(run.cycleSpectating&&this.cycleFollowedId!==undefined&&this.cycleFollowedId!==followedId){
        this.cycleSwitch={position:this.camera.position.clone(),look:this.look.clone(),rotation:this.camera.quaternion.clone(),elapsed:0};
        this.collisionRecovery.active=false;this.freshCamera=false;
      }
      this.cycleFollowedId=followedId;
      // Track translation with the same pose used by the cycle mesh. Smoothing
      // absolute positions makes fixed simulation steps bob against the camera,
      // especially at turbo speed. Only ease the orbit/height relative to it.
      if(this.cycleAnchor&&!this.freshCamera&&!this.cycleSwitch){
        const moveX=pose.x-this.cycleAnchor.x,moveZ=this.cycleAnchor.s-pose.s;
        this.camera.position.x+=moveX;this.camera.position.z+=moveZ;
        this.look.x+=moveX;this.look.z+=moveZ;
      }
      this.cycleAnchor=pose;
      const bike=cycleRace.cycles.find(b=>b.id===followedId),escaped=bike?.escaped;
      const glanceTarget=-(this.cycleGlanceInput||0)*CYCLE_CAMERA.glanceRadians;
      const glanceResponse=escaped?CYCLE_CAMERA.roadGlanceResponsePerSecond:CYCLE_CAMERA.glanceResponsePerSecond;
      this.cycleGlance+=(glanceTarget-this.cycleGlance)*(1-Math.exp(-dt*glanceResponse));
      const glanceMix=Math.min(1,Math.abs(this.cycleGlance)/(Math.PI/3));
      // Anticipate the intended bend rather than waiting for chassis yaw.
      // Fade at walking pace/rest and give deliberate J/L glances priority.
      const turnTarget=escaped&&!this.aerial?-(bike.steering||0)*CYCLE_CAMERA.turnLookRadians*Math.min(1,Math.max(0,bike.roadSpeed||0)/CYCLE_CAMERA.turnLookFullSpeedMetersPerSecond):0;
      this.cycleTurnLook+=(turnTarget-this.cycleTurnLook)*(1-Math.exp(-dt*CYCLE_CAMERA.turnLookResponsePerSecond));
      const lookYaw=pose.yaw+this.cycleTurnLook*(1-glanceMix);
      const orbitYaw=lookYaw+this.cycleGlance;
      this.desired.set(pose.x+Math.sin(orbitYaw)*CYCLE_CAMERA.distanceMeters,CYCLE_CAMERA.heightMeters,-pose.s+Math.cos(orbitYaw)*CYCLE_CAMERA.distanceMeters);
      this.lookDesired.set(pose.x-Math.sin(lookYaw)*CYCLE_CAMERA.lookAheadMeters*(1-glanceMix),CYCLE_CAMERA.lookHeightMeters,-pose.s-Math.cos(lookYaw)*CYCLE_CAMERA.lookAheadMeters*(1-glanceMix));
      const modeAerialMix=this.frame?.aerialMix??(this.aerial?1:0);
      const {mix:aerialMix,scale:aerialScale}=this.cluAerialFraming(modeAerialMix);
      // I/K pulls back along a shallow boom so both the bike and horizon fit.
      // V retains its deliberately steep aerial perspective.
      const horizonDistance=AERIAL_CAMERA.height/Math.tan(THREE.MathUtils.degToRad(config.fov)*CYCLE_GLANCE.followPitchFovFraction);
      const aerialDistance=THREE.MathUtils.lerp(horizonDistance,AERIAL_CAMERA.distance,modeAerialMix)*aerialScale;
      this.desired.lerp(new THREE.Vector3(pose.x+Math.sin(orbitYaw)*aerialDistance,AERIAL_CAMERA.height*aerialScale,-pose.s+Math.cos(orbitYaw)*aerialDistance),aerialMix);
      this.lookDesired.lerp(new THREE.Vector3(pose.x,0,-pose.s),aerialMix);
      const wallDistance=ARENA_WALL.innerMeters-Math.max(Math.abs(pose.x-cycleRace.site.x),Math.abs(pose.s-cycleRace.site.s));
      const cockpitAllowed=wallDistance>=0&&this.cycleOpening===null&&!escaped&&bike?.alive&&aerialMix===0;
      this.cycleCockpit=!!cockpitAllowed&&wallDistance<(this.cycleCockpit?CYCLE_COCKPIT.exitWallDistanceMeters:CYCLE_COCKPIT.enterWallDistanceMeters);
      const cockpitTarget=this.cycleCockpit?1:0;
      this.cycleCockpitMix=this.freshCamera?cockpitTarget:THREE.MathUtils.lerp(this.cycleCockpitMix,cockpitTarget,1-Math.exp(-dt*CYCLE_COCKPIT.responsePerSecond));
      if(this.cycleOpening!==null)this.cycleCockpitMix=0;
      const cockpitEye=cycleCameraAnchor(pose,cycleRace,CYCLE_COCKPIT.eyeHeightMeters,CAMERA_CLEARANCE.radiusMeters);
      cockpitEye.x+=Math.sin(orbitYaw)*CYCLE_COCKPIT.backMeters;
      cockpitEye.z+=Math.cos(orbitYaw)*CYCLE_COCKPIT.backMeters;
      if(wallDistance>=0){
        const limit=ARENA_WALL.innerMeters-CAMERA_CLEARANCE.radiusMeters-CAMERA_CLEARANCE.contactMarginMeters;
        cockpitEye.x=cycleRace.site.x+THREE.MathUtils.clamp(cockpitEye.x-cycleRace.site.x,-limit,limit);
        cockpitEye.z=-cycleRace.site.s+THREE.MathUtils.clamp(cockpitEye.z+cycleRace.site.s,-limit,limit);
      }
      // If the wall removes the rear offset, use a little room to either
      // side so the cycle remains in frame beneath this elevated camera.
      if(this.cycleCockpit&&Math.hypot(cockpitEye.x-pose.x,cockpitEye.z+pose.s)<1){
        const limit=ARENA_WALL.innerMeters-CAMERA_CLEARANCE.radiusMeters-CAMERA_CLEARANCE.contactMarginMeters;
        let best=cockpitEye;
        for(const side of [-1,1]){
          const candidate=cockpitEye.clone().add(new THREE.Vector3(Math.cos(orbitYaw)*CYCLE_COCKPIT.sideMeters*side,0,-Math.sin(orbitYaw)*CYCLE_COCKPIT.sideMeters*side));
          candidate.x=cycleRace.site.x+THREE.MathUtils.clamp(candidate.x-cycleRace.site.x,-limit,limit);
          candidate.z=-cycleRace.site.s+THREE.MathUtils.clamp(candidate.z+cycleRace.site.s,-limit,limit);
          if(Math.hypot(candidate.x-pose.x,candidate.z+pose.s)>Math.hypot(best.x-pose.x,best.z+pose.s))best=candidate;
        }
        cockpitEye.copy(best);
      }
      const cockpitLook=new THREE.Vector3(pose.x,CYCLE_COCKPIT.eyeHeightMeters,-pose.s).add(new THREE.Vector3(-Math.sin(orbitYaw),0,-Math.cos(orbitYaw)).multiplyScalar(CYCLE_COCKPIT.lookAheadMeters));
      cockpitLook.y=CYCLE_COCKPIT.lookHeightMeters;
      this.desired.lerp(cockpitEye,this.cycleCockpitMix);
      this.lookDesired.lerp(cockpitLook,this.cycleCockpitMix);
      // When zooming out from the rider position, clear the roof before
      // moving beyond the enclosure; smoothing into its face would stall.
      const roofClearance=ARENA_CAMERA_WALL_HEIGHT+CAMERA_CLEARANCE.radiusMeters+CAMERA_CLEARANCE.contactMarginMeters;
      if(this.cycleOpening===null&&wallDistance>=0&&aerialMix>0&&this.desired.y>roofClearance&&this.camera.position.y<roofClearance&&!this.freshCamera){
        const limit=ARENA_WALL.innerMeters-CAMERA_CLEARANCE.radiusMeters-CAMERA_CLEARANCE.contactMarginMeters;
        this.desired.x=cycleRace.site.x+THREE.MathUtils.clamp(this.desired.x-cycleRace.site.x,-limit,limit);
        this.desired.z=-cycleRace.site.s+THREE.MathUtils.clamp(this.desired.z+cycleRace.site.s,-limit,limit);
      }
      const insideLimit=ARENA_WALL.innerMeters-CAMERA_CLEARANCE.radiusMeters-CAMERA_CLEARANCE.contactMarginMeters;
      const cockpitReturn=this.cycleCockpit&&Math.max(Math.abs(this.camera.position.x-cycleRace.site.x),Math.abs(this.camera.position.z+cycleRace.site.s))>insideLimit;
      if(cockpitReturn){
        this.desired.copy(cockpitEye);
        this.desired.y=Math.max(this.camera.position.y,roofClearance);
      }
      const openingRoll=this.cycleOpening===null?0:applyCycleOpening(this.cycleOpening,cycleRace.site,this.desired,this.lookDesired);
      const cycleAnchor=cycleCameraAnchor(pose,cycleRace,CYCLE_CAMERA.wallAnchorHeightMeters,CAMERA_CLEARANCE.radiusMeters);
      const cycleWorld=cycleCameraWorld(this.world,cycleRace);
      if(this.cycleOpening===null&&aerialMix===0&&this.cycleCockpitMix<.01&&cycleWallFollowPosition(cycleWorld,pose,cycleRace,this.desired,cycleAnchor,CAMERA_CLEARANCE.radiusMeters,previousCamera))
        this.lookDesired.lerp(new THREE.Vector3(pose.x,CYCLE_CAMERA.lookHeightMeters,-pose.s),.5);
      const blend=this.cycleOpening!==null||this.freshCamera?1:1-Math.exp(-dt*CYCLE_CAMERA.responsePerSecond);
      if(this.cycleSwitch){
        const transition=this.cycleSwitch;
        transition.elapsed+=mode==='paused'?0:dt;
        const t=THREE.MathUtils.smootherstep(Math.min(1,transition.elapsed/CYCLE_SWITCH_SECONDS),0,1);
        this.camera.position.lerpVectors(transition.position,this.desired,t);
        this.look.lerpVectors(transition.look,this.lookDesired,t);
        transition.mix=t;
      }else{
        this.camera.position.lerp(this.desired,blend);this.look.lerp(this.lookDesired,blend);
      }
      if(cockpitReturn&&previousCamera&&previousCamera.y<roofClearance){
        // First rise vertically on the current side of the wall, then cross.
        this.camera.position.copy(previousCamera);
        this.camera.position.y=THREE.MathUtils.lerp(previousCamera.y,roofClearance+1,blend);
      }
      // Cockpit recovery must follow the bike instead of climbing/stalling on
      // the wall. The raised anchor and rider eye are both inside the arena.
      if(this.cycleCockpitMix>.01)this.collisionRecovery.active=false;
      constrainCamera(cycleWorld,cycleAnchor,this.camera.position,previousCamera,CAMERA_CLEARANCE.radiusMeters,this.cycleOpening===null&&aerialMix===0&&!cockpitReturn,this.cycleCockpitMix>.01?null:this.collisionRecovery,dt);
      // Interpolating look-at points can flip the camera when the flight
      // path passes through one. Blend orientations toward the destination
      // framing instead, independently of the camera's translation.
      const cameraLook=this.cycleSwitch
        ?this.camera.position.clone().add(this.lookDesired.clone().sub(this.desired))
        :this.look.clone();
      if(this.cycleOpening===null){
        // When a wall shortens the boom, look down toward the bike instead of
        // keeping an eight-meter forward target that loses it below frame.
        const distance=Math.hypot(this.camera.position.x-pose.x,this.camera.position.z+pose.s);
        const close=1-THREE.MathUtils.smoothstep(distance,CYCLE_CAMERA.closeLookNearMeters,CYCLE_CAMERA.closeLookFarMeters);
        cameraLook.lerp(new THREE.Vector3(pose.x,CYCLE_CAMERA.lookHeightMeters,-pose.s),close*(1-this.cycleCockpitMix)*(this.cycleSwitch?0:1));
        // Keep the horizon in the follow view, including after wall avoidance.
        // Apply after wall correction without moving the collision-safe camera.
        const direction=cameraLook.clone().sub(this.camera.position),length=direction.length();
        const horizontal=Math.hypot(direction.x,direction.z);
        const pitch=Math.atan2(-direction.y,horizontal);
        const glancePitch=Math.min(pitch,THREE.MathUtils.degToRad(config.fov)*CYCLE_GLANCE.horizonPitchFovFraction);
        const followPitch=Math.min(pitch,THREE.MathUtils.degToRad(config.fov)*CYCLE_GLANCE.followPitchFovFraction);
        const basePitch=THREE.MathUtils.lerp(followPitch,pitch,modeAerialMix);
        const viewPitch=THREE.MathUtils.lerp(basePitch,glancePitch,glanceMix);
        if(horizontal>1e-6){
          direction.multiplyScalar(length*Math.cos(viewPitch)/horizontal);
          direction.y=-length*Math.sin(viewPitch);
          cameraLook.copy(this.camera.position).add(direction);
        }
      }
      this.camera.lookAt(cameraLook);
      this.camera.rotateZ(openingRoll);
      if(this.cycleSwitch){
        const transition=this.cycleSwitch,target=this.camera.quaternion.clone();
        this.camera.quaternion.slerpQuaternions(transition.rotation,target,transition.mix);
        if(transition.mix===1)this.cycleSwitch=null;
      }
      this.camera.far=12000;
      this.camera.fov=this.cycleOpening===null?config.fov:THREE.MathUtils.lerp(config.fov,CYCLE_FORMATION_CAMERA.fovDegrees,cycleFormationBlend(this.cycleOpening));
      this.camera.updateProjectionMatrix();this.freshCamera=false;
      return {tankVisible:false};
    }
    this.cycleAnchor=null;
    const previousCamera=this.freshCamera?null:this.camera.position.clone();
    if(!previousCamera)this.collisionRecovery.active=false;
    const { cinematic, aerialMix:modeAerialMix, preview, gunner } = this.frame,
      { wallIntersection, lineOfSight } = this.world;
    const {mix:aerialMix,scale:aerialScale}=this.cluAerialFraming(modeAerialMix);
    const encounterWeight=1-THREE.MathUtils.smoothstep(aerialMix,0,ENCOUNTER_FRAMING.fadeOutAerialMix);
    let tankVisible = !run.crushed && !gunner;
    let overhead = null;
    const cameraYaw = cinematic?.yaw ?? yaw + turretYaw;
    if (
      !cinematic &&
      !preview &&
      encounterWeight > 0 &&
      this.opening == null &&
      !this.referenceCamera
    ) {
      for (const e of [...run.recognizers, ...fragments]) {
        if (e.state === 'destroyed') continue;
        const dx = e.x - x,
          dz = -e.s + s,
          distance = Math.hypot(dx, dz);
        const ahead = -Math.sin(cameraYaw) * dx - Math.cos(cameraYaw) * dz;
        const side = Math.abs(Math.cos(cameraYaw) * dx - Math.sin(cameraYaw) * dz);
        if (distance > 110 || ahead < -8 || side > 30 + Math.max(0, ahead) * 0.7) continue;
        if (!lineOfSight({ x, s, y: config.cameraHeight }, { x: e.x, s: e.s, y: e.y })) continue;
        if (!overhead || distance < overhead.distance) overhead = { e, distance };
      }
    }
    const focus = overhead ? (1 - THREE.MathUtils.smoothstep(overhead.distance, 25, 110))*encounterWeight : 0;
    this.encounterFocus = THREE.MathUtils.lerp(
      this.encounterFocus || 0,
      focus,
      1 - Math.exp(-dt * 2),
    );
    if (preview) {
      this.desired.set(x + 15, 9, -s + 22);
      this.lookDesired.set(x - 5, 5, -s - 22);
    } else {
      // A little extra distance makes room for both the tank and an overhead
      // craft; tilting alone would put Clu below the bottom of the frame.
      const distance = (config.cameraDistance + 32 * this.encounterFocus);
      this.desired.set(
        x + Math.sin(cameraYaw) * distance,
        config.cameraHeight,
        -s + Math.cos(cameraYaw) * distance,
      );
      this.lookDesired.set(x - Math.sin(cameraYaw) * 30, 5.1, -s - Math.cos(cameraYaw) * 30);
    }
    if (!preview && this.opening == null && !this.referenceCamera) {
      // Clip the driving endpoint before blending so descent stays continuous near walls.
      clipCameraSegment(this.world,new THREE.Vector3(x,CAMERA_CLEARANCE.anchorHeightMeters,-s),this.desired);
      const distance = AERIAL_CAMERA.distance * aerialScale;
      this.desired.lerp(
        new THREE.Vector3(
          x + Math.sin(cameraYaw) * distance,
          AERIAL_CAMERA.height * aerialScale,
          -s + Math.cos(cameraYaw) * distance,
        ),
        aerialMix,
      );
      this.lookDesired.lerp(new THREE.Vector3(x, 0, -s), aerialMix);
    }
    const blend =
      this.freshCamera || cinematic
        ? 1
        : 1 - Math.exp(-dt * (this.reducedMotion ? 13 : config.cameraLag));
    // Keep chase smoothing independent of the displayed gunner/transition camera.
    // Feeding the blended position back here made exit pitch corrections oscillate.
    this.followPosition.lerp(this.desired, blend);
    this.camera.position.copy(this.followPosition);
    this.look.lerp(this.lookDesired, blend);
    if (!preview && aerialMix === 0) {
      clipCameraSegment(this.world,new THREE.Vector3(x,CAMERA_CLEARANCE.anchorHeightMeters,-s),this.camera.position);
    }
    if (this.opening != null) {
      const t = THREE.MathUtils.smoothstep(this.opening, 0, 1);
      const height = Math.exp(
        THREE.MathUtils.lerp(Math.log(320), Math.log(config.cameraHeight), t),
      );
      const distance = THREE.MathUtils.lerp(500, config.cameraDistance, t);
      this.camera.position.set(
        x + Math.sin(cameraYaw) * distance + 70 * (1 - t),
        height,
        -s + Math.cos(cameraYaw) * distance,
      );
      this.look.set(x - Math.sin(cameraYaw) * 30 * t, 5.1 * t, -s - Math.cos(cameraYaw) * 30 * t);
    }
    if (this.referenceCamera) {
      this.camera.position.copy(this.referenceCamera.position);
      this.look.copy(this.referenceCamera.target);
    }
    const encounterFov = config.fov + 8 * this.encounterFocus;
    if (
      !cinematic &&
      !preview &&
      this.opening == null &&
      !this.referenceCamera
    ) {
      const basePitch = Math.atan2(
        this.look.y - this.camera.position.y,
        Math.hypot(this.look.x - this.camera.position.x, this.look.z - this.camera.position.z),
      );
      const tankPitch = Math.atan2(
        2 - this.camera.position.y,
        Math.hypot(x - this.camera.position.x, -s - this.camera.position.z),
      );
      const craftPitch = overhead
        ? Math.atan2(
            overhead.e.y - this.camera.position.y,
            Math.hypot(
              overhead.e.x - this.camera.position.x,
              -overhead.e.s - this.camera.position.z,
            ),
          )
        : basePitch;
      const targetPitch = overhead
        ? Math.max(basePitch, (tankPitch + craftPitch) * 0.5)
        : basePitch;
      this.encounterPitch = THREE.MathUtils.lerp(
        this.encounterPitch ?? basePitch,
        targetPitch,
        1 - Math.exp(-dt * 2),
      );
      // Clamp against the tank's top, including after camera/wall collision.
      const pitch = THREE.MathUtils.lerp(basePitch,Math.min(
        this.encounterPitch,
        tankPitch + THREE.MathUtils.degToRad(encounterFov * 0.5 - 5),
      ),encounterWeight);
      const length = Math.hypot(
        this.look.x - this.camera.position.x,
        this.look.z - this.camera.position.z,
      );
      this.camera.lookAt(
        this.look.x,
        this.camera.position.y + Math.tan(pitch) * length,
        this.look.z,
      );
    } else this.camera.lookAt(this.look);
    this.followPosition.copy(this.camera.position);
    this.freshCamera = false;
    if (gunner) {
      // Anchor the sight at the turret pivot, not the muzzle: motor correction
      // must not orbit the camera or feed changing parallax back into mouse aim.
      const pose = {
        x: x + Math.cos(yaw) * TANK.pivot[0] + Math.sin(yaw) * TANK.pivot[2],
        s: s + Math.sin(yaw) * TANK.pivot[0] - Math.cos(yaw) * TANK.pivot[2],
        y: TANK.muzzle[1],
        yaw: yaw + turretYaw,
      };
      const pitch =
        (previous.aimPitch ?? run.aimPitch) +
        (run.aimPitch - (previous.aimPitch ?? run.aimPitch)) * alpha;
      const obstruction = wallIntersection({ x, s, y: pose.y }, pose, 0.2);
      if (obstruction !== null) {
        const t = Math.max(0, obstruction - 0.02);
        pose.x = x + (pose.x - x) * t;
        pose.s = s + (pose.s - s) * t;
      }
      this.camera.position.set(pose.x, pose.y, -pose.s);
      const aim = this.mouseLook || { yaw: pose.yaw, pitch };
      this.camera.lookAt(
        pose.x - Math.sin(aim.yaw) * Math.cos(aim.pitch) * 100,
        pose.y + Math.sin(aim.pitch) * 100,
        -pose.s - Math.cos(aim.yaw) * Math.cos(aim.pitch) * 100,
      );
    }
    const zoomTarget = GUNNER.fovs[run.gunnerZoom];
    if (!gunner || this.reducedMotion || this.zoomFov == null) {
      this.zoomFov = zoomTarget;
      this.zoomTarget = zoomTarget;
      this.zoomTransition = null;
    } else if (zoomTarget !== this.zoomTarget) {
      this.zoomTransition = { from: this.zoomFov, elapsed: 0 };
      this.zoomTarget = zoomTarget;
    }
    if (this.zoomTransition) {
      this.zoomTransition.elapsed += dt;
      const t = THREE.MathUtils.smootherstep(
        Math.min(1, this.zoomTransition.elapsed / GUNNER_ZOOM_SECONDS),
        0,
        1,
      );
      this.zoomFov = THREE.MathUtils.lerp(this.zoomTransition.from, zoomTarget, t);
      if (t === 1) this.zoomTransition = null;
    }
    this.camera.far = 12000;
    this.camera.fov = gunner
      ? this.zoomFov
      : (this.referenceCamera?.fov ??
        (cinematic || this.aerial || preview || this.opening != null ? config.fov : encounterFov));
    this.gunnerOpacity = gunner ? 1 : 0;
    if (this.gunnerTransition) {
      const transition = this.gunnerTransition;
      transition.elapsed += dt;
      const t = THREE.MathUtils.smootherstep(
        Math.min(1, transition.elapsed / GUNNER_TRANSITION_SECONDS),
        0,
        1,
      );
      const origin = transition.position
        .clone()
        .add(new THREE.Vector3(x - transition.x, 0, -s + transition.s));
      this.camera.position.lerpVectors(origin, this.camera.position, t);
      this.camera.quaternion.slerpQuaternions(
        transition.rotation,
        this.camera.quaternion.clone(),
        t,
      );
      this.camera.fov = THREE.MathUtils.lerp(transition.fov, this.camera.fov, t);
      this.gunnerOpacity = THREE.MathUtils.lerp(transition.opacity, gunner ? 1 : 0, t);
      // Hide the exterior model only as the camera enters its volume.
      tankVisible =
        !run.crushed &&
        (Math.hypot(this.camera.position.x - x, this.camera.position.z + s) > 7 ||
          this.camera.position.y > 5);
      if (t === 1) {
        this.gunnerTransition = null;
        if (gunner) tankVisible = false;
      }
    }
    if(!preview&&!this.referenceCamera){
      const radius=gunner?CAMERA_CLEARANCE.gunnerRadiusMeters:CAMERA_CLEARANCE.radiusMeters;
      const corrected=constrainCamera(this.world,new THREE.Vector3(x,CAMERA_CLEARANCE.anchorHeightMeters,-s),this.camera.position,previousCamera,radius,aerialMix===0&&this.opening===null,this.collisionRecovery,dt,!gunner&&aerialMix===0&&this.opening==null);
      if(corrected&&!gunner&&!this.gunnerTransition)this.camera.lookAt(this.look);
      if(!gunner&&!this.gunnerTransition)this.followPosition.copy(this.camera.position);
    }
    this.camera.updateProjectionMatrix();
    // Apply only to the final camera orientation: no drift in follow smoothing or aim.
    // Simulation time freezes the vibration on pause; impact decays in ~0.4 seconds.
    if (!preview && !this.referenceCamera && !this.reducedMotion) {
      const strength =
        (run.impact ** 1.5 * Math.tan((this.camera.fov * Math.PI) / 360)) /
        Math.tan((config.fov * Math.PI) / 360);
      const t = run.time;
      this.camera.rotateX(
        strength * IMPACT_SHAKE.pitch * (Math.sin(t * 83) + 0.35 * Math.sin(t * 139)),
      );
      this.camera.rotateY(
        strength * IMPACT_SHAKE.yaw * (Math.sin(t * 109) + 0.3 * Math.cos(t * 173)),
      );
      this.camera.rotateZ(strength * IMPACT_SHAKE.roll * Math.sin(t * 97));
    }
    this.gunScreen = null;
    if (gunner && this.mouseLook) {
      this.camera.updateMatrixWorld();
      const heading = yaw + turretYaw;
      const pitch =
        (previous.aimPitch ?? run.aimPitch) +
        (run.aimPitch - (previous.aimPitch ?? run.aimPitch)) * alpha;
      const d = new THREE.Vector3(
        -Math.sin(heading) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(heading) * Math.cos(pitch),
      );
      this.gunScreen = d.multiplyScalar(1000).add(this.camera.position).project(this.camera);
    }
    return { tankVisible };
  }
}
