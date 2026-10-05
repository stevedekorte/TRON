import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../docs/models/tron_1982_solar_sailer.glb?url';
import { SOLAR_SAILER, solarSailerPose } from '../game/solar-sailer.js';

export const SAILER_STYLE=Object.freeze({sailOpacity:.48,starLongRadiusMeters:4.5,starShortRadiusMeters:2.4,starHalfWidthMeters:.16,tipLightRadiusMeters:.14});

export async function loadSolarSailer({previewBeam=false}={}) {
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
    material.roughness = .65;
    material.metalness = .25;
    const light = /^TxTS0[4-7]/.test(material.name);
    if (light) {
      material.emissive.copy(material.color);
      material.emissiveMap = material.map;
      material.emissiveIntensity = 2.4;
      if (material.name.startsWith('TxTS04')) {
        material.color.setHex(0xfff4d9);
        material.emissive.setHex(0xfff4d9);
        material.emissiveMap = null;
      }
    } else {
      material.color.setHex(0x182338);
      material.emissive.setHex(0x111a30);
      material.emissiveIntensity = .25;
    }
    material.userData.sailerOpacity = 1;
  }
  // The two broad sail meshes include separate fabric and structural patches.
  // Clone their materials so translucency never leaks onto hull panels.
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    let node=mesh, sail=false;
    while(node && node!==source){if(/^Mesh(14|39)(_|$)/.test(node.name))sail=true;node=node.parent;}
    if(!sail)return;
    mesh.material=[].concat(mesh.material).map(original=>{
      const material=original.clone();
      material.name='Translucent sail '+original.name;
      material.map=null;material.color.setHex(0x64718e);
      material.emissive.setHex(0x1b2540);material.emissiveIntensity=.25;
      material.opacity=SAILER_STYLE.sailOpacity;material.userData.sailerOpacity=SAILER_STYLE.sailOpacity;
      material.side=THREE.DoubleSide;material.depthWrite=false;
      material.roughness=.38;material.metalness=.15;
      materials.add(material);return material;
    });
    if(mesh.material.length===1)mesh.material=mesh.material[0];
  });
  // Keep the very small source navigation lamps readable at sky-lane distances.
  const lampGeometry=new THREE.SphereGeometry(SAILER_STYLE.tipLightRadiusMeters,8,6);
  source.traverse(node=>{
    const match=/^Mesh(22|23|24|25|26|28|29|30|33)$/.exec(node.name);
    if(!match)return;
    const center=new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()).sub(anchor);
    const id=Number(match[1]),color=id===23?0x70ff63:id===24?0xff536d:0xffd9ef;
    const material=new THREE.MeshBasicMaterial({color,transparent:true,toneMapped:false,fog:false});
    material.userData.sailerOpacity=1;materials.add(material);
    const lamp=new THREE.Mesh(lampGeometry,material);lamp.name='Sail navigation light';lamp.position.copy(center);ship.add(lamp);
  });
  // A small three-dimensional white star marks the forward beam coupling.
  const nose=new THREE.Box3();
  source.traverse(mesh=>{if(/^Mesh38$/.test(mesh.name))nose.union(new THREE.Box3().setFromObject(mesh));});
  if(!nose.isEmpty()){
    const center=nose.getCenter(new THREE.Vector3()).sub(anchor);center.z=nose.max.z-anchor.z;
    const positions=[];
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6, length=i%2?SAILER_STYLE.starShortRadiusMeters:SAILER_STYLE.starLongRadiusMeters, width=SAILER_STYLE.starHalfWidthMeters;
      const x=Math.cos(angle),y=Math.sin(angle);
      positions.push(-y*width,x*width,0,x*length,y*length,.6,y*width,-x*width,0);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const material=new THREE.MeshBasicMaterial({color:0xe9eeff,side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
    material.userData.sailerOpacity=1;materials.add(material);
    const star=new THREE.Mesh(geometry,material);star.name='Beam coupling star';star.position.copy(center);ship.add(star);
  }
  ship.updateMatrixWorld(true);
  const hullBounds = new THREE.Box3();
  source.traverse(mesh => {
    if (mesh.isMesh && mesh.visible) hullBounds.union(new THREE.Box3().setFromObject(mesh));
  });
  if(previewBeam){
    const geometry=new THREE.CylinderGeometry(1,1,1,8);
    for(const [start,end] of [[hullBounds.min.x-12,hullBounds.min.x],[hullBounds.max.x,hullBounds.max.x+12]]){
      for(const [radius,color,opacity] of [[.18,0xfff9e5,1],[.5,0xb6c7ff,.12]]){
        const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
        material.userData.sailerOpacity=opacity;materials.add(material);
        const beam=new THREE.Mesh(geometry,material);beam.name='Credit transit beam';beam.rotation.x=Math.PI/2;
        beam.position.z=(start+end)/2;beam.scale.set(radius,end-start,radius);ship.add(beam);
      }
    }
  }
  return { ship, materials, beamGap: { min: hullBounds.min.x, max: hullBounds.max.x } };
}

const translucentColor=new THREE.Color(0x64718e),fullColor=new THREE.Color(0xe4e5ec);
const translucentGlow=new THREE.Color(0x1b2540),fullGlow=new THREE.Color(0xa0a7be);
export function applySolarSailerState(materials,charge,opacity=1){
  for(const material of materials){
    if(material.name.startsWith('Translucent sail')){
      material.color.lerpColors(translucentColor,fullColor,charge);
      material.emissive.lerpColors(translucentGlow,fullGlow,charge);
      material.emissiveIntensity=.25+.55*charge;
      material.opacity=opacity*(SAILER_STYLE.sailOpacity+(1-SAILER_STYLE.sailOpacity)*charge);
      material.depthWrite=material.opacity>=.999;
    }else material.opacity=opacity*(material.userData.sailerOpacity??1);
  }
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
    for (const side of [-1, 1]) for (const [radius, color, opacity] of [[1, 0xfff9e5, 1], [3, 0xb6c7ff, 0.12]]) {
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
    applySolarSailerState(this.materials,pose.charge,pose.opacity);
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
