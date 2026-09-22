import * as THREE from 'three';
import { BeamCamera } from './beam-camera.js';
import { config, GUNNER, gunnerAimScale } from '../game/config.js';
import { TANK } from '../game/tank.js';
const AERIAL_CAMERA = Object.freeze({
  transitionSeconds: 1.2,
  height: 600,
  distance: Math.hypot(180, 320),
});
const GUNNER_TRANSITION_SECONDS = 0.75;
const IMPACT_SHAKE = Object.freeze({ pitch: 0.012, yaw: 0.009, roll: 0.006 });
const GUNNER_ZOOM_SECONDS = 0.35;
/** Owns camera modes and smoothing, but no scene/effect resources. */
export class CameraRig {
  constructor(world) {
    this.world = world;
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, 0.15, 2500);
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
    this.beamCamera.reset();
    this.beamCinematic = null;
    this.zoomTransition = null;
    this.zoomFov = undefined;
    this.zoomTarget = undefined;
    this.gunnerTransition = null;
    this.wasGunner = false;
    this.gunnerOpacity = 0;
    this.aerialBlend = 0;
    this.encounterFocus = 0;
    this.encounterPitch = undefined;
    this.freshCamera = true;
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
  begin(run, dt, mode) {
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
  update(run, previous, alpha, dt, mode, { x, s, yaw, turretYaw, fragments = [] }) {
    const { cinematic, aerialMix, preview, gunner } = this.frame,
      { wallIntersection, lineOfSight } = this.world;
    let tankVisible = !run.crushed && !gunner;
    let overhead = null;
    const cameraYaw = cinematic?.yaw ?? yaw + turretYaw;
    if (
      !cinematic &&
      !preview &&
      aerialMix === 0 &&
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
    const focus = overhead ? 1 - THREE.MathUtils.smoothstep(overhead.distance, 25, 110) : 0;
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
      const distance = config.cameraDistance + 32 * this.encounterFocus;
      this.desired.set(
        x + Math.sin(cameraYaw) * distance,
        config.cameraHeight,
        -s + Math.cos(cameraYaw) * distance,
      );
      this.lookDesired.set(x - Math.sin(cameraYaw) * 30, 5.1, -s - Math.cos(cameraYaw) * 30);
    }
    if (!preview && this.opening == null && !this.referenceCamera) {
      // Clip the driving endpoint before blending so descent stays continuous near walls.
      const anchor = { x, s, y: 3.5 },
        end = { x: this.desired.x, s: -this.desired.z, y: this.desired.y };
      const hit = wallIntersection(anchor, end, 1.2);
      if (hit !== null) {
        const t = Math.max(0.05, hit - 0.06);
        this.desired.set(x + (end.x - x) * t, 3.5 + (end.y - 3.5) * t, -s - (end.s - s) * t);
      }
      const distance = AERIAL_CAMERA.distance * this.aerialZoom;
      this.desired.lerp(
        new THREE.Vector3(
          x + Math.sin(cameraYaw) * distance,
          AERIAL_CAMERA.height * this.aerialZoom,
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
      const anchor = { x, s, y: 3.5 },
        end = { x: this.camera.position.x, s: -this.camera.position.z, y: this.camera.position.y };
      const collision = wallIntersection(anchor, end, 1.2);
      if (collision !== null) {
        const t = Math.max(0.05, collision - 0.06);
        this.camera.position.set(
          x + (end.x - x) * t,
          3.5 + (end.y - 3.5) * t,
          -s - (end.s - s) * t,
        );
      }
    }
    if (this.opening != null) {
      const t = THREE.MathUtils.smoothstep(this.opening, 0.15, 1);
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
      aerialMix === 0 &&
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
      const pitch = Math.min(
        this.encounterPitch,
        tankPitch + THREE.MathUtils.degToRad(encounterFov * 0.5 - 5),
      );
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
