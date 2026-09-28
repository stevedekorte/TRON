import * as THREE from 'three';
export const FREE_CAMERA = Object.freeze({ speedMetersPerSecond: 180, fastMultiplier: 5, lookRadiansPerPixel: 0.003, keyboardRadiansPerSecond: 1.2 });
export const SPECTATOR_CAMERA = Object.freeze({
  speedMetersPerSecond: 36, keyboardRadiansPerSecond: .7,
  moveResponsePerSecond: 8, lookResponsePerSecond: 8,
});
/** Free camera; the application owns simulation pause and input listeners. */
export class FreeCamera {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lookVelocity = new THREE.Vector2();
  }
  enter({ spectator = false } = {}) {
    this.spectator = spectator;
    this.velocity.set(0,0,0);this.lookVelocity.set(0,0);
    this.saved = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.rotation.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.camera.fov = 60;
    this.camera.far = 12000;
    this.camera.updateProjectionMatrix();
    this.active = true;
  }
  exit() {
    this.active = false;
    this.velocity.set(0,0,0);this.lookVelocity.set(0,0);
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
    let yaw=axis('ArrowRight','ArrowLeft'),pitch=axis('ArrowDown','ArrowUp');
    if(this.spectator){
      yaw=THREE.MathUtils.clamp(yaw+axis('KeyL','KeyJ'),-1,1);
      pitch=THREE.MathUtils.clamp(pitch+axis('KeyK','KeyI'),-1,1);
      const response=1-Math.exp(-SPECTATOR_CAMERA.lookResponsePerSecond*dt);
      this.lookVelocity.x+=(yaw*SPECTATOR_CAMERA.keyboardRadiansPerSecond-this.lookVelocity.x)*response;
      this.lookVelocity.y+=(pitch*SPECTATOR_CAMERA.keyboardRadiansPerSecond-this.lookVelocity.y)*response;
      this.look(this.lookVelocity.x*dt/FREE_CAMERA.lookRadiansPerPixel,this.lookVelocity.y*dt/FREE_CAMERA.lookRadiansPerPixel);
    }else{
      const look=FREE_CAMERA.keyboardRadiansPerSecond/FREE_CAMERA.lookRadiansPerPixel*dt;
      this.look(yaw*look,pitch*look);
    }
    this.direction.set(axis('KeyD', 'KeyA'), 0, axis('KeyS', 'KeyW')).applyQuaternion(this.camera.quaternion);
    this.direction.y += axis('KeyE', 'KeyQ');
    if (this.direction.lengthSq() > 1) this.direction.normalize();
    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed=(this.spectator?SPECTATOR_CAMERA.speedMetersPerSecond:FREE_CAMERA.speedMetersPerSecond)*(fast?FREE_CAMERA.fastMultiplier:1);
    if(this.spectator){
      this.direction.multiplyScalar(speed);
      this.velocity.lerp(this.direction,1-Math.exp(-SPECTATOR_CAMERA.moveResponsePerSecond*dt));
      this.camera.position.addScaledVector(this.velocity,dt);
    }else this.camera.position.addScaledVector(this.direction,dt*speed);
    this.camera.position.y = Math.max(0.5, this.camera.position.y);
  }
}
