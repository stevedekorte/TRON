import * as THREE from 'three';
import { cannonPose } from '../simulation/run.js';

export function mouseTarget(run, look, camera, roots) {
  if (!look) return null;
  const { yaw, pitch } = look;
  const direction = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
  const ray = new THREE.Raycaster(camera.position, direction, 0, 12000),
    meshes = [];
  for (const root of roots) {
    if (!root) continue;
    root.updateWorldMatrix(true, true);
    root.traverseVisible((o) => {
      if (o.isMesh && !o.isSprite && !(o.material?.transparent && o.material?.depthWrite === false))
        meshes.push(o);
    });
  }
  const hit = ray.intersectObjects(meshes, false)[0];
  const point = hit?.point || ray.ray.at(12000, new THREE.Vector3());
  const muzzle = cannonPose(run),
    delta = point.clone().sub(new THREE.Vector3(muzzle.x, muzzle.y, -muzzle.s));
  return {
    yaw: Math.atan2(-delta.x, -delta.z),
    pitch: Math.atan2(delta.y, Math.hypot(delta.x, delta.z)),
  };
}
