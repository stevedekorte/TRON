import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createCarrierShuttle} from './rendering/carrier-shuttle.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x07141d);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,1000);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,4,0);controls.enableDamping=true;controls.minDistance=18;controls.maxDistance=140;
scene.add(new T.HemisphereLight(0x263940,0xdbe7e8,1.4));const key=new T.DirectionalLight(0xe4ece5,2.5);key.position.set(-25,-40,35);scene.add(key);
const model=createCarrierShuttle();scene.add(model);
const poses={reference:[-28,-23,44],detach:[30,-30,-40],side:[44,13,0],top:[0,58,.01],rear:[0,12,50],under:[30,-25,-38]};
function setView(name){controls.autoRotate=false;camera.position.set(...poses[name]);controls.target.set(0,4,0);controls.update();}
setView('detach');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelector('#spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.7;};
async function exportModel(){return new GLTFExporter().parseAsync(model,{binary:true});}
document.querySelector('#export').onclick=async()=>{const url=URL.createObjectURL(new Blob([await exportModel()],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='carrier-escape-shuttle.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});document.querySelector('#status').textContent=`${triangles.toLocaleString()} triangles · 20 × 14 × 9 m provisional envelope`;
window.shuttle={model,setView,exportModel,triangles};window.shuttleReady=true;
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();model.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())m?.dispose();});renderer.dispose();});
