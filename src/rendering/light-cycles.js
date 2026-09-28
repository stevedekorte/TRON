import {CarrierMaterialization} from './carrier-materialization.js';
import {CycleTireTraces} from './cycle-tire-traces.js';
import {materializationDuration,materializationPhase} from '../game/materialization.js';
import { CycleExplosions } from './cycle-explosions.js';
import { RecognizerShadows } from './recognizer-shadows.js';
import { repairCycleSurface, repairCycleHubs } from './cycle-surface.js';
import { LightCycleWalls } from './light-cycle-walls.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import goldUrl from '../../docs/models/preti_light_cycle_gold.glb?url';
import blueUrl from '../../docs/models/preti_light_cycle_blue.glb?url';
import { LIGHT_CYCLES as C, cycleFraction } from '../game/light-cycles.js';
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
    scene.userData.groundOffsetMeters=-new THREE.Box3().setFromObject(scene).min.y;
    // Measure the repaired rear tire instead of guessing its contact offset.
    scene.updateMatrixWorld(true);
    const rear=[];
    scene.traverse(mesh=>{if(mesh.isMesh){const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);if(p.z>0)rear.push(p);
    }}});
    const bottom=Math.min(...rear.map(p=>p.y)),contact=new THREE.Vector3();let count=0;
    for(const p of rear)if(p.y<=bottom+.003){contact.add(p);count++;}
    scene.userData.rearTireContact=contact.multiplyScalar(1/count).divide(scene.scale).toArray();
    return scene;
  }));
}
export class LightCycleRaceView {
  constructor(models,arena,floorReceivers=[],{arenaFloor,groundFloor}={}){
    this.arenaFloor=arenaFloor;this.groundFloor=groundFloor;
    this.root=new THREE.Group();this.root.name='Light cycle competition';arena.add(this.root);
    this.bikes=Array.from({length:6},(_,id)=>{const root=models[id<3?0:1].clone(true);root.name=`Light cycle ${id+1}`;const materials=new Map();root.traverse(o=>{if(o.isMesh){const clone=m=>{if(!materials.has(m)){const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;materials.set(m,c);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});this.root.add(root);return root;});
    this.materializations=this.bikes.map(root=>new CarrierMaterialization(root,{axis:'z',reverse:false,isLiveMaterial:()=>false}));
    const receivers=[...floorReceivers];
    const crafts=this.bikes.map(root=>{const casters=[];root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude){casters.push(o);receivers.push(o);}});return {root,casters,radius:2.6,distance:8};});
    this.shadows=new RecognizerShadows(crafts,receivers,0,{size:512,prefix:'cycleShadow',darkness:.65,filterEdges:true,depthBias:.002});
    this.wallRenderer=new LightCycleWalls(this.root);
    this.trails=this.wallRenderer.meshes;
    this.explosions=new CycleExplosions(this.root);
    this.tireTraces=new CycleTireTraces(this.root,{arenaFloor,groundFloor,contactFor:b=>{
      const mesh=this.bikes[b.id];mesh.updateMatrix();
      return new THREE.Vector3().fromArray(mesh.userData.rearTireContact).applyMatrix4(mesh.matrix);
    }});

  }
  update(r){
    this.root.visible=!!r&&r.phase!=='idle';if(!this.root.visible){this.tireTraces.update(null);return;}
    const fraction=r.phase==='racing'?r.accumulator/(C.cellMeters/C.speedMetersPerSecond):1;
    for(const b of r.cycles){const fraction=cycleFraction(r,b);const mesh=this.bikes[b.id];mesh.visible=b.alive;
      const x=THREE.MathUtils.lerp(b.previousX,b.x,fraction)*C.cellMeters,z=THREE.MathUtils.lerp(b.previousZ,b.z,fraction)*C.cellMeters;
      const onArena=this.arenaFloor&&Math.abs(x)<=this.arenaFloor.geometry.parameters.width/2&&Math.abs(z)<=this.arenaFloor.geometry.parameters.height/2;
      const floor=onArena?this.arenaFloor:this.groundFloor;
      mesh.position.set(x,(floor?.position.y??0)+(mesh.userData.groundOffsetMeters??0),z);mesh.rotation.set(0,b.yaw??-b.dir*Math.PI/2,b.lean??0);
      const rez=this.materializations[b.id];
      const age=r.phase==='countdown'?Math.max(0,C.countdownSeconds-r.remaining):null;
      mesh.visible=b.alive&&(age===null||age>0);
      if(age===null)rez.update(null);
      else {
        const phase=materializationPhase(age/C.countdownSeconds*materializationDuration());
        rez.update(age,null,{phase,cut:THREE.MathUtils.lerp(rez.bounds.min.z,rez.bounds.max.z,phase.wire)});

      }
      // Cycles reveal without the carrier's sweeping plate or its border.
      rez.rectangle.visible=false;
    }
    this.tireTraces.update(r);
    this.wallRenderer.update(r,fraction);
    this.explosions.update(r);

  }
}
