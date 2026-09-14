import * as T from 'three';
import carrierUrl from '../docs/models/tron_1982_carrier.glb?url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const renderer=new T.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=T.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x03050c);
const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,100000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new T.HemisphereLight(0xc2d8ff,0x262030,2));
const light=new T.DirectionalLight(0xffffff,3);light.position.set(-1,2,1);scene.add(light);
try {
  const {scene:model}=await new GLTFLoader().loadAsync(carrierUrl);
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
  model.position.sub(bounds.getCenter(new T.Vector3()));scene.add(model);
  const extent=Math.max(size.x,size.y,size.z);
  camera.near=extent/10000;camera.far=extent*50;camera.updateProjectionMatrix();
  camera.position.set(extent*.8,extent*.5,extent*.8);
  controls.minDistance=extent*.03;controls.maxDistance=extent*6;controls.update();
  document.querySelector('#status').textContent='Original proportions and materials';
  renderer.render(scene,camera);window.carrierReady=true;
} catch(error){document.querySelector('#status').textContent=error.message;throw error;}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
