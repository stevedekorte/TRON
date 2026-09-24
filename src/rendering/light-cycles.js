import { RecognizerShadows } from './recognizer-shadows.js';
import { repairCycleSurface, repairCycleHubs } from './cycle-surface.js';
import { LightCycleWalls } from './light-cycle-walls.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import goldUrl from '../../docs/models/preti_light_cycle_gold.glb?url';
import blueUrl from '../../docs/models/preti_light_cycle_blue.glb?url';
import { LIGHT_CYCLES as C } from '../game/light-cycles.js';
export const CYCLE_MODEL_STYLE=Object.freeze({blueBody:0x086ac4,blueTrim:0x084b92,ambientScale:.35});
export async function loadLightCycles(){
  return Promise.all([goldUrl,blueUrl].map(async(url,team)=>{
    const {scene}=await new GLTFLoader().loadAsync(url);
    const bounds=new THREE.Box3().setFromObject(scene);
    scene.scale.setScalar(C.lengthMeters/(bounds.max.z-bounds.min.z));
    scene.traverse(o=>{if(o.isMesh){const original=o.geometry;o.geometry=repairCycleSurface(original);original.dispose();o.material.roughness=.4;o.material.metalness=.15;
      if(team===1&&o.material.name==='Color_I03')o.material.color.setHex(CYCLE_MODEL_STYLE.blueBody);
      if(team===1&&o.material.name==='_6')o.material.color.setHex(CYCLE_MODEL_STYLE.blueTrim);}});
    const materials=new Set();scene.traverse(o=>{if(o.isMesh)materials.add(o.material);});
    for(const material of materials){
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight -= reflectedLight.indirectDiffuse * ${1-CYCLE_MODEL_STYLE.ambientScale};\n#include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>`cycle-directional-${CYCLE_MODEL_STYLE.ambientScale}`;
    }
    repairCycleHubs(scene);
    return scene;
  }));
}
export class LightCycleRaceView {
  constructor(models,arena){
    this.root=new THREE.Group();this.root.name='Light cycle competition';arena.add(this.root);
    this.bikes=Array.from({length:6},(_,id)=>{const root=models[id<3?0:1].clone(true);root.name=`Light cycle ${id+1}`;this.root.add(root);return root;});
    const receivers=[];
    const crafts=this.bikes.map(root=>{const casters=[];root.traverse(o=>{if(o.isMesh){casters.push(o);receivers.push(o);}});return {root,casters,radius:2.6,distance:8};});
    this.shadows=new RecognizerShadows(crafts,receivers,0,{size:512,prefix:'cycleShadow',darkness:.65,filterEdges:true,depthBias:.002});
    this.wallRenderer=new LightCycleWalls(this.root);
    this.trails=this.wallRenderer.meshes;
    this.flashes=Array.from({length:6},(_,i)=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:C.colors[i<3?0:1],transparent:true,opacity:0,depthWrite:false,toneMapped:false}));m.visible=false;this.root.add(m);return m;});

  }
  update(r){
    this.root.visible=!!r;if(!r)return;
    const fraction=r.phase==='racing'?r.accumulator/(C.cellMeters/C.speedMetersPerSecond):1;
    for(const b of r.cycles){const mesh=this.bikes[b.id];mesh.visible=b.alive;mesh.position.set(THREE.MathUtils.lerp(b.previousX,b.x,fraction)*C.cellMeters,.08,THREE.MathUtils.lerp(b.previousZ,b.z,fraction)*C.cellMeters);mesh.rotation.y=-b.dir*Math.PI/2;}
    this.wallRenderer.update(r,fraction);
    for(const b of r.cycles){const flash=this.flashes[b.id],crash=r.crashes.find(c=>c.id===b.id);const age=crash?r.time-crash.time:Infinity;flash.visible=age<.8;if(flash.visible){flash.position.set(crash.x*C.cellMeters,1.5,crash.z*C.cellMeters);flash.scale.setScalar(1+age*10);flash.material.opacity=(1-age/.8)*.9;}}

  }
}
