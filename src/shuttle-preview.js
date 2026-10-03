import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPlanarShuttle} from './rendering/shuttle-planar.js';
import {cleanShuttleGeometry} from './rendering/shuttle-cleanup.js';
import {createCarrierShuttle} from './rendering/carrier-shuttle.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x07141d);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,1000);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,4,0);controls.enableDamping=true;controls.minDistance=18;controls.maxDistance=140;
scene.add(new T.HemisphereLight(0x263940,0xdbe7e8,1.4));const key=new T.DirectionalLight(0xe4ece5,2.5);key.position.set(-25,-40,35);scene.add(key);
const variant=new URLSearchParams(location.search).get('model')||'meshy-preserved';
const meshy=['meshy','meshy-isolated','meshy-detail','meshy-clean','meshy-preserved'].includes(variant);
let model;
if(meshy){
 const loaded=await new GLTFLoader().loadAsync(`./docs/models/carrier-shuttle/${['meshy-clean','meshy-preserved'].includes(variant)?'meshy-isolated':variant}/${new URLSearchParams(location.search).has('raw')?'shuttle-original':'shuttle'}.glb`);
 model=new T.Group();model.name='Meshy shuttle candidate';
 const asset=loaded.scene;
 if(['meshy-clean','meshy-preserved'].includes(variant))asset.traverse(o=>{
  if(!o.isMesh)return;
  const old=o.geometry;o.geometry=cleanShuttleGeometry(old,variant==='meshy-preserved'?{iterations:0,planeToleranceFraction:.003,planeNormalThreshold:.98,minPlaneVertices:120,weldPrecision:1000000,creaseAngleRadians:Math.PI/6}:{});old.dispose();
  for(const material of [o.material].flat()){
   if(variant==='meshy-preserved'){material.normalScale.set(.2,.2);continue;}
   material.map=null;material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;
   material.color.setHex(0x929ba5);
   material.roughness=.82;material.metalness=.04;material.needsUpdate=true;
  }
 });
 const bounds=new T.Box3().setFromObject(asset),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 const scale=20/Math.max(size.x,size.y,size.z);
 asset.position.copy(center).multiplyScalar(-scale);asset.scale.setScalar(scale);model.add(asset);model.position.y=4;
 model.userData={source:'Meshy multi-image generation from supplied film stills',provisional:true,cleanup:variant==='meshy-preserved'?'Original detailed mesh and materials; conservative panel flattening; X/Y symmetry':variant==='meshy-clean'?'Smoothed and planarized; mirrored across X and Y; neutral surface material':null};
}else model=variant==='planar'?createPlanarShuttle():createCarrierShuttle();
scene.add(model);
const poses={reference:[-28,-23,44],detach:[30,-30,-40],side:[44,13,0],top:[0,58,.01],rear:[0,12,50],under:[30,-25,-38]};
function setView(name){controls.autoRotate=false;camera.position.set(...poses[name]);controls.target.set(0,4,0);controls.update();}
setView('detach');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelector('#spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.7;};
async function exportModel(){return new GLTFExporter().parseAsync(model,{binary:true});}
document.querySelector('#export').onclick=async()=>{const url=URL.createObjectURL(new Blob([await exportModel()],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='carrier-escape-shuttle.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});document.querySelector('#status').textContent=`${triangles.toLocaleString()} triangles · ${meshy?"Meshy candidate · 20 m longest dimension":variant==='planar'?'Flat panels · quarter-circle front corners':'20 × 14 × 9 m provisional envelope'}`;
window.shuttle={model,setView,exportModel,triangles};window.shuttleReady=true;
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();model.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat()){if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});renderer.dispose();});
