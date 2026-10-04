import { browserScenario } from './game/browser-scenario.js';
const { world } = browserScenario(location);
import * as THREE from 'three';
import { View } from './rendering/view.js';
import { loadVehicles } from './rendering/models.js';
import { createRun } from './simulation/run.js';
const { cellCenter } = world;
const refs = import.meta.glob('../docs/references/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const reference = (name) => {
  const url = refs['../docs/references/images/' + name + '.png'];
  if (!url) throw new Error('Missing reference image: ' + name);
  return url;
};
const shots = {
  blueprint: {
    image: 'Maze Blue Print',
    position: [0, 0, 0],
    camera: [0, 1054, 0.001],
    target: [0, 54, 0],
    fov: 41.25,
    fogScale: 0,
  },
  close: {
    image: 'CLU Close Up',
    position: [-1850, 0, 1800],
    camera: [5, 8, -12],
    target: [1, 0.3, 0],
    fov: 26,
    yaw: 0,
    turretYaw: -1.15,
  },
  rear: {
    image: 'Inside Maze',
    position: [-1850, 0, 1800],
    camera: [8, 3.7, 15],
    target: [0, 2, 0],
    fov: 43,
  },
  maze: {
    image: 'Maze Top 1',
    position: [0, 0, 0],
    camera: [-1239, 150, 333],
    target: [-719, -40, -80],
    fov: 50,
    fogScale: 0.35,
  },
  details: {
    image: 'Maze Details',
    position: [cellCenter(12, 3).x, 0, -cellCenter(12, 3).s],
    camera: [-25, 38, 35],
    target: [0, 12, -30],
    fov: 48,
  },
  drive: {
    image: 'Inside Maze',
    position: [cellCenter(12, 3).x, 0, -cellCenter(12, 3).s],
    camera: [8, 4, 16],
    target: [0, 2, 0],
    fov: 43,
  },
};
let view, run, active;
async function init() {
  const [tank, recognizer, boss] = await loadVehicles();
  view = new View(document.querySelector('canvas'), tank, recognizer, null, null, world, null, null, boss);
  run = createRun(undefined, world);
  run.recognizers.forEach((e) => (e.state = 'destroyed'));
  run.time = 0;
  view.resize = () => {
    const bounds = document.querySelector('#viewport').getBoundingClientRect(),
      w = Math.round(bounds.width),
      h = Math.round(bounds.height);
    view.camera.aspect = w / h;
    view.camera.updateProjectionMatrix();
    view.renderer.setSize(w, h, false);
    view.composer.setSize(w, h);
  };
  function select(name) {
    active = name;
    const shot = shots[name];
    view.tank.root.visible = true;
    run.x = shot.position[0];
    run.s = -shot.position[2];
    run.yaw = shot.yaw ?? 0;
    run.turretYaw = shot.turretYaw ?? 0;
    const offset = new THREE.Vector3(...shot.position);
    view.cameraRig.referenceCamera = {
      position: new THREE.Vector3(...shot.camera).add(offset),
      target: new THREE.Vector3(...shot.target).add(offset),
      fov: shot.fov,
      fogScale: shot.fogScale ?? 1,
    };
    document
      .querySelectorAll('[data-shot]')
      .forEach((b) => b.setAttribute('aria-pressed', b.dataset.shot === name));
    for (const id of ['reference', 'overlay'])
      document.getElementById(id).src = reference(shot.image);
    document.querySelector('#status').textContent =
      name === 'maze'
        ? 'Low oblique overview: broad blue roofs, tapered ends and dark channels.'
        : 'Fixed film-study camera. No vehicle motion or changing light during comparison.';
    view.reset();
    draw();
    if (name === 'blueprint') {
      view.tank.root.visible = false;
      view.composer.render(0);
    }
  }
  function draw() {
    view.resize();
    view.render(run, run, 1, 0, 'paused');
  }
  document
    .querySelectorAll('[data-shot]')
    .forEach((b) => (b.onclick = () => select(b.dataset.shot)));
  document.querySelector('#mix').oninput = (e) =>
    (document.querySelector('#overlay').style.opacity = e.target.value);
  window.addEventListener('resize', draw);
  window.addEventListener('pagehide', () => view.dispose(), { once: true });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      window.removeEventListener('resize', draw);
      view.dispose();
    });
  const requested = new URLSearchParams(location.search).get('shot');
  select(shots[requested] ? requested : 'close');
  window.__reference = {
    select,
    draw,
    get shot() {
      return active;
    },
    view,
  };
}
init().catch((e) => {
  document.querySelector('#status').textContent = e.message;
  console.error(e);
});
