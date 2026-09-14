import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import carrierUrl from '../../docs/models/tron_1982_carrier.glb?url';
import {CARRIER} from '../game/carrier.js';
export async function loadCarrier(){
 const {scene:root}=await new GLTFLoader().loadAsync(carrierUrl);
 root.position.sub(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));
 const ship=new THREE.Group();ship.add(root);
 const materials=new Set();root.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>materials.add(m));});
 for(const material of materials){
  // Distant sky objects should not disappear in ground-level maze fog.
  material.fog=false;material.roughness=.8;material.metalness=.15;
  if(material.name.startsWith('TxTC01')){
   // Preserve the source panel colors and texture contrast. Most of the
   // brightness comes from lighting; only a trace of fill reaches the shadows.
   material.color.multiplyScalar(.65);
   material.roughness=.55;material.metalness=.25;
   material.emissive.setHex(0x1b2e49);material.emissiveIntensity=.28;
   material.emissiveMap=null;
  }
  else {material.emissive.copy(material.color);material.emissiveMap=material.map;material.emissiveIntensity=material.name.startsWith('TxTC02')?.45:material.name.startsWith('TxTC07')?2.6:1.6;
   if(material.name.startsWith('TxTC02')){material.color.multiplyScalar(.6);material.emissive.multiplyScalar(.6);}
   // Source trim lies against the hull. Keep coplanar paint visible rather
   // than letting the opaque armor intermittently cover it at a distance.
   material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-2;
  }
 }
 // Trace real armor panel boundaries, excluding coplanar triangulation.
 // These understated blue seams reveal the smaller hull sections.
 const armor=[];root.traverse(o=>{if(o.isMesh&&o.material?.name.startsWith('TxTC01'))armor.push(o);});
 const seamMaterial=new THREE.LineBasicMaterial({color:0x304d6b,transparent:true,opacity:.65,fog:false,depthWrite:false});
 for(const mesh of armor){
  const seams=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),seamMaterial);
  mesh.add(seams);
 }
 const beacons=[];
 root.traverse(mesh=>{
  // Small red lamp meshes are separate from the long, steady red outlines.
  if(!mesh.isMesh||!mesh.material?.name.startsWith('TxTC02')||mesh.geometry.attributes.position.count>288)return;
  mesh.material=mesh.material.clone();
  beacons.push({material:mesh.material,phase:(beacons.length%3)/3});
 });
 ship.userData.beacons=beacons;
 updateCarrier(ship,0);return ship;
}
export function updateCarrier(ship,time){ship.position.set(CARRIER.startX+CARRIER.speed*time,CARRIER.altitude,-CARRIER.s);
 // Approximation from the final moving shot: roughly one pulse per second,
 // with a short bright interval and groups out of phase. Outlines stay steady.
 for(const beacon of ship.userData.beacons||[]){
  const phase=(time+beacon.phase)%1;
  const pulse=Math.max(0,Math.min(1,phase/.06,(.34-phase)/.1));
  beacon.material.emissiveIntensity=.1+3*pulse;
 }
}
