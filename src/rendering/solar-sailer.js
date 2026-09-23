import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../docs/models/tron_1982_solar_sailer.glb?url';
import { SOLAR_SAILER, solarSailerPose } from '../game/solar-sailer.js';

export async function loadSolarSailer() {
  const { scene: source } = await new GLTFLoader().loadAsync(modelUrl);
  source.updateMatrixWorld(true);
  // The original yellow guide beam is a separate long, narrow mesh. Its center
  // locates the actual sail/hull axis; the overall hull bounds do not.
  const beams = [];
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.z > 150 && size.x < 1 && size.y < 1) beams.push({ mesh, bounds });
  });
  if (!beams.length) throw new Error('Solar Sailer source guide beam missing');
  const anchor = beams[0].bounds.getCenter(new THREE.Vector3());
  // Keep hidden source resources attached so scene disposal still owns them.
  for (const { mesh } of beams) mesh.visible = false;
  source.position.sub(anchor);
  const ship = new THREE.Group();
  ship.add(source);
  ship.rotation.y = Math.PI / 2; // Film reference: the sail end leads the +X transit.
  const materials = new Set();
  source.traverse(mesh => {
    if (mesh.isMesh) for (const material of [].concat(mesh.material)) materials.add(material);
  });
  for (const material of materials) {
    material.fog = false;
    material.transparent = true;
    material.roughness = 0.65;
    material.metalness = 0.25;
    const light = /^TxTS0[4-7]/.test(material.name);
    if (light) {
      material.emissive.copy(material.color);
      material.emissiveMap = material.map;
      material.emissiveIntensity = 1.8;
      // Warm amber rigging rather than the source's saturated yellow.
      if (material.name.startsWith('TxTS04')) material.emissive.setHex(0xffb84a);
    } else {
      material.emissive.setHex(0x25344d);
      material.emissiveIntensity = 0.4;
    }
  }
  ship.updateMatrixWorld(true);
  const hullBounds = new THREE.Box3();
  source.traverse(mesh => {
    if (mesh.isMesh && mesh.visible) hullBounds.union(new THREE.Box3().setFromObject(mesh));
  });
  return { ship, materials, beamGap: { min: hullBounds.min.x, max: hullBounds.max.x } };
}

export class SolarSailer {
  constructor(model, scene, world, settings = SOLAR_SAILER) {
    this.settings = settings;
    this.world = world;
    this.ship = model.ship;
    this.materials = model.materials;
    this.beamGap = model.beamGap;
    this.root = new THREE.Group();
    this.root.name = 'Solar Sailer sky lane';
    this.root.add(this.ship);
    this.beam = new THREE.Group();
    this.root.add(this.beam);
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 8);
    for (const side of [-1, 1]) for (const [radius, color, opacity] of [[1, 0xffe1a0, 1], [3, 0xffaa38, 0.12]]) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = Math.PI / 2;
      mesh.userData.radius = radius;
      mesh.userData.baseOpacity = opacity;
      mesh.userData.side = side;
      this.beam.add(mesh);
    }
    scene.add(this.root);
    this.update(0);
  }
  update(time, visible = true) {
    const settings = this.settings;
    const pose = solarSailerPose(time, this.world, settings);
    this.root.visible = visible && settings.enabled;
    this.ship.visible = pose.visible;
    this.ship.position.set(pose.x, pose.y, pose.z);
    this.ship.scale.setScalar(settings.scale);
    for (const material of this.materials) material.opacity = pose.opacity;
    this.beam.visible = pose.beamOpacity > 0;
    this.beam.position.set(this.world.SPAWN.x, pose.y, pose.z);
    for (const mesh of this.beam.children) {
      mesh.material.opacity = mesh.userData.baseOpacity * pose.beamOpacity;
      const radius = settings.beamRadiusMeters * mesh.userData.radius;
      const half = settings.beamLengthMeters / 2;
      const split = pose.visible && pose.opacity > 0;
      const center = pose.x - this.world.SPAWN.x;
      const gapMin = center + this.beamGap.min * settings.scale;
      const gapMax = center + this.beamGap.max * settings.scale;
      const left = mesh.userData.side < 0;
      const from = left ? -half : split ? gapMax : 0;
      const to = left ? split ? gapMin : 0 : half;
      const start = Math.max(-half, Math.min(half, from));
      const end = Math.max(-half, Math.min(half, to));
      mesh.visible = end > start;
      mesh.position.x = (start + end) / 2;
      mesh.scale.set(radius, Math.max(0, end - start), radius);
    }
  }
  // GPU resources belong to View's scene and are disposed once with that scene.
}
