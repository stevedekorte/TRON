import {ArenaBreaches} from './arena-breaches.js';
import { loadLightCycles, LightCycleRaceView } from './light-cycles.js';
import { arenaSite } from '../levels/arena.js';
export { arenaSite } from '../levels/arena.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../docs/models/preti_light_cycle_arena.glb?url';
import { createArenaFloor } from './arena-floor.js';
import { styleArena } from './arena-style.js';

export async function loadArena(world,floorReceivers=[]) {
  const site = arenaSite(world);
  if (!site) return null;
  const [{ scene }, cycles] = await Promise.all([new GLTFLoader().loadAsync(modelUrl), loadLightCycles()]);
  const group = new THREE.Group();
  group.name = 'Light cycle arena';
  group.position.set(site.x, 0, -site.s);
  const floor = createArenaFloor({ elevationMeters: 0.02 });
  floor.material.polygonOffset = true;
  floor.material.polygonOffsetFactor = -2;
  floor.material.polygonOffsetUnits = -4;
  floor.renderOrder = -1.8;
  const architecture = new THREE.Group();
  architecture.add(scene);
  group.add(architecture, floor);
  // The purchased game-sector extract contains the decorated inner walls and
  // their top ledges, but no continuous exterior enclosure.
  const bounds = new THREE.Box3().setFromObject(scene);
  const width = bounds.max.x - bounds.min.x, depth = bounds.max.z - bounds.min.z;
  const height = bounds.max.y - bounds.min.y;
  const shellMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const [x, z, yaw, span] of [
    [bounds.min.x, 0, -Math.PI / 2, depth], [bounds.max.x, 0, Math.PI / 2, depth],
    [0, bounds.min.z, Math.PI, width], [0, bounds.max.z, 0, width],
  ]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(span, height), shellMaterial);
    wall.name = 'Arena_exterior_wall';
    wall.position.set(x, bounds.min.y + height / 2, z);
    wall.rotation.y = yaw;
    architecture.add(wall);
  }
  const style = styleArena(architecture);
  group.userData.arenaStyle = style;
  group.userData.breaches = new ArenaBreaches(architecture,style);
  group.userData.cycleRace = new LightCycleRaceView(cycles, group,[floor,...floorReceivers],{arenaFloor:floor,groundFloor:floorReceivers[0]});
  return group;
}
