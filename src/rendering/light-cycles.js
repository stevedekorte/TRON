import {MP} from '../../shared/multiplayer/config.js';
import {installHumanStripe,installHumanWireStripe} from './cycle-human-stripe.js';
import {refineCycleFrontWheel} from './cycle-front-wheel.js';
import {advanceWheelReflection} from './cycle-wheel-reflections.js';
import {repairCycleRearSeams,repairCyclePanelWinding} from './cycle-rear-seams.js';
import {repairCyclePanelOverlaps} from './cycle-panel-overlaps.js';
import {CarrierMaterialization} from './carrier-materialization.js';
import {CYCLE_OPENING,CYCLE_FORMATION_MATERIALIZATION} from './cycle-opening.js';
import {CycleTireTraces} from './cycle-tire-traces.js';
import {materializationDuration,materializationPhase} from '../game/materialization.js';
import { CycleExplosions } from './cycle-explosions.js';
import { RecognizerShadows } from './recognizer-shadows.js';
import { repairCycleSurface, repairCycleHubs, refineCycleRearWheel, refineCycleWheelInteriors, removeCycleWheelHighlights, applyCycleBlackRims, removeCycleInscriptions, applyCycleMaterialLighting } from './cycle-surface.js';
import { LightCycleWalls } from './light-cycle-walls.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import goldUrl from '../../assets/runtime/models/preti_light_cycle_gold.glb?url';
import blueUrl from '../../assets/runtime/models/preti_light_cycle_blue.glb?url';
import { LIGHT_CYCLES as C, cycleFraction } from '../../shared/simulation/config/light-cycles.js';
export const CYCLE_SELF_SHADOW=Object.freeze({size:1024,prefix:'cycleShadow',darkness:.65,maxCrafts:6,filterEdges:'soft',depthBias:.002});
export const CYCLE_MODEL_STYLE=Object.freeze({blueBody:0x086ac4,blueTrim:0x084b92,redBody:0xff1010,redTrim:0xff4840,ambientScale:.35});
export async function loadLightCycles({refineWheels=true}={}){
  return Promise.all([goldUrl,blueUrl].map(async(url,team)=>{
    const {scene}=await new GLTFLoader().loadAsync(url);
    removeCycleInscriptions(scene);
    const bounds=new THREE.Box3().setFromObject(scene);
    scene.scale.setScalar(C.lengthMeters/(bounds.max.z-bounds.min.z));
    scene.traverse(o=>{if(o.isMesh){const original=o.geometry;o.geometry=repairCycleSurface(original);original.dispose();
      if(team===1&&o.material.name==='Color_I03')o.material.color.setHex(CYCLE_MODEL_STYLE.blueBody);
      if(team===1&&o.material.name==='_6')o.material.color.setHex(CYCLE_MODEL_STYLE.blueTrim);}});
    repairCycleRearSeams(scene);
    repairCyclePanelOverlaps(scene);
    repairCyclePanelWinding(scene);
    repairCycleHubs(scene);
    if(refineWheels){refineCycleRearWheel(scene);refineCycleFrontWheel(scene);refineCycleWheelInteriors(scene);removeCycleWheelHighlights(scene);applyCycleBlackRims(scene);}
    applyCycleMaterialLighting(scene);
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
    this.bikes=Array.from({length:C.maxCycles},(_,id)=>{const root=models[0].clone(true);root.name=`Light cycle ${id+1}`;const materials=new Map();root.traverse(o=>{if(o.isMesh){const clone=m=>{if(!materials.has(m)){const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;c.userData.originalCycleColor=m.color?.clone();materials.set(m,c);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});this.root.add(root);installHumanStripe(root);return root;});
    this.materializations=this.bikes.map(root=>{const rez=new CarrierMaterialization(root,{axis:'z',reverse:false,isLiveMaterial:()=>false});installHumanWireStripe(root,rez);return rez;});
    const receivers=[...floorReceivers];
    const crafts=this.bikes.map(root=>{const casters=[];root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude){casters.push(o);receivers.push(o);}});return {root,casters,radius:2.6,distance:8};});
    this.shadows=new RecognizerShadows(crafts,receivers,0,CYCLE_SELF_SHADOW);
    this.wallRenderer=new LightCycleWalls(this.root);
    this.trails=this.wallRenderer.meshes;
    this.explosions=new CycleExplosions(this.root);
    this.tireTraces=new CycleTireTraces(this.root,{arenaFloor,groundFloor,contactFor:b=>{
      const mesh=this.bikes[b.id];mesh.updateMatrix();
      return new THREE.Vector3().fromArray(mesh.userData.rearTireContact).applyMatrix4(mesh.matrix);
    }});

  }
  update(r,openingFormationAge=null){
    this.root.visible=!!r&&r.phase!=='idle';if(!this.root.visible){this.tireTraces.update(null);return;}
    for(const mesh of this.bikes)mesh.visible=false;
    const fraction=r.phase==='racing'?r.accumulator/(C.cellMeters/C.speedMetersPerSecond):1;
    for(const b of r.cycles){const fraction=cycleFraction(r,b);const mesh=this.bikes[b.id];mesh.visible=b.alive;mesh.userData.human=!!b.human;mesh.userData.humanStripe.value=b.human?1:0;
      if(mesh.userData.team!==b.team){
        mesh.userData.team=b.team;
        const palette=[null,[CYCLE_MODEL_STYLE.blueBody,CYCLE_MODEL_STYLE.blueTrim],[CYCLE_MODEL_STYLE.redBody,CYCLE_MODEL_STYLE.redTrim],[0x178c42,0x46bd65]][b.team];
        mesh.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material)){
          if(m.userData.originalCycleColor)m.color.copy(m.userData.originalCycleColor);
          if(palette&&m.name==='Color_D06')m.color.setHex(palette[0]);
          if(palette&&['_1','Color_L12'].includes(m.name))m.color.setHex(palette[1]);
          if(m.name==='Color_D06')this.materializations[b.id].lineMaterial.color.copy(m.color);
        }});
      }
      const x=THREE.MathUtils.lerp(b.previousX,b.x,fraction)*C.cellMeters,z=THREE.MathUtils.lerp(b.previousZ,b.z,fraction)*C.cellMeters;
      const onArena=this.arenaFloor&&Math.abs(x)<=this.arenaFloor.geometry.parameters.width/2&&Math.abs(z)<=this.arenaFloor.geometry.parameters.height/2;
      const floor=onArena?this.arenaFloor:this.groundFloor;
      mesh.position.set(x,(floor?.position.y??0)+(mesh.userData.groundOffsetMeters??0),z);mesh.rotation.set(0,b.yaw??-b.dir*Math.PI/2,b.lean??0);
      const rez=this.materializations[b.id];
      const multiplayerFormation=r.cameraStaging!==undefined;
      const formationDuration=multiplayerFormation?MP.formationSeconds:openingFormationAge===null?C.countdownSeconds:CYCLE_OPENING.formationSeconds;
      const age=multiplayerFormation?(r.phase==='countdown'?(r.cameraStaging||!r.materializing?0:Math.max(0,MP.materializationSeconds-r.remaining)):null):openingFormationAge??(r.phase==='countdown'?Math.max(0,C.countdownSeconds-r.remaining):null);
      mesh.visible=b.alive&&(age===null||age>0)&&(openingFormationAge===null||b.team===0);
      mesh.userData.cycleFormationProgress=age===null?1:THREE.MathUtils.clamp(age/formationDuration,0,1);
      const moving=age===null&&r.phase==='racing'&&b.alive&&!r.arenaPaused;
      const speed=moving?(b.escaped?(b.roadSpeed??0):C.speedMetersPerSecond*(b.speedMultiplier??1)):0;
      // Interpolated cycle objects are replaced every rendered frame. Reset only
      // for a new match, never on a presentation object's identity.
      // The seed is mutable AI random state, not a match identifier. Using it
      // here restarts every wheel's clock whenever an AI makes a decision.
      const reflectionKey=`${r.round}:${b.id}`;
      if(mesh.userData.reflectionKey!==reflectionKey||r.time<(mesh.userData.wheelReflection?.time??0)){mesh.userData.reflectionKey=reflectionKey;mesh.userData.wheelReflection=null;}
      mesh.userData.wheelReflection=advanceWheelReflection(mesh.userData.wheelReflection,r.time,speed);
      if(age===null)rez.update(null);
      else {
        const timing=openingFormationAge===null&&!multiplayerFormation?undefined:CYCLE_FORMATION_MATERIALIZATION;
        const phase=materializationPhase(age/formationDuration*materializationDuration(timing),timing);
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
