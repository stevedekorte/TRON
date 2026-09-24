import * as THREE from 'three';
export const FREE_CAMERA = Object.freeze({ speedMetersPerSecond: 180, fastMultiplier: 5, lookRadiansPerPixel: 0.003, keyboardRadiansPerSecond: 1.2 });
/** Inspection camera; the application pauses simulation and owns input listeners. */
export class FreeCamera {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3();
  }
  enter() {
    this.saved = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.rotation.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.camera.fov = 60;
    this.camera.far = 12000;
    this.camera.updateProjectionMatrix();
    this.active = true;
  }
  exit() {
    this.active = false;
    this.camera.position.copy(this.saved.position);
    this.camera.quaternion.copy(this.saved.quaternion);
    this.camera.fov = this.saved.fov;
    this.camera.updateProjectionMatrix();
  }
  look(dx, dy) {
    this.rotation.y -= dx * FREE_CAMERA.lookRadiansPerPixel;
    this.rotation.x = THREE.MathUtils.clamp(this.rotation.x - dy * FREE_CAMERA.lookRadiansPerPixel, -1.55, 1.55);
    this.camera.quaternion.setFromEuler(this.rotation);
  }
  update(dt, keys) {
    if (!this.active) return;
    const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
    const look = FREE_CAMERA.keyboardRadiansPerSecond / FREE_CAMERA.lookRadiansPerPixel * dt;
    this.look(axis('ArrowRight', 'ArrowLeft') * look, axis('ArrowDown', 'ArrowUp') * look);
    this.direction.set(axis('KeyD', 'KeyA'), 0, axis('KeyS', 'KeyW')).applyQuaternion(this.camera.quaternion);
    this.direction.y += axis('KeyE', 'KeyQ');
    if (this.direction.lengthSq() > 1) this.direction.normalize();
    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
    this.camera.position.addScaledVector(this.direction, dt * FREE_CAMERA.speedMetersPerSecond * (fast ? FREE_CAMERA.fastMultiplier : 1));
    this.camera.position.y = Math.max(0.5, this.camera.position.y);
  }
}
