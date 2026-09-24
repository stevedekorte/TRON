import * as THREE from 'three';
import {createBlast} from './blast.js';

export const SURFACE_IMPACT=Object.freeze({offsetMeters:.08,lifetimeSeconds:.8,maxActive:48});
export class SurfaceImpacts {
 constructor(scene){this.scene=scene;this.effects=[];}
 spawn(event,object=null){
  const point=new THREE.Vector3(event.x,event.y,-event.s);
  let normal=event.normal&&new THREE.Vector3(event.normal.x,event.normal.y,event.normal.z);
  if(!normal&&object&&event.shotFrom){
   const origin=new THREE.Vector3(event.shotFrom.x,event.shotFrom.y,event.shotFrom.z),direction=point.clone().sub(origin).normalize();
   // Simulation armor zones are coarse; place the optical effect on the visible mesh.
   const ray=new THREE.Raycaster(origin.clone().addScaledVector(direction,-4),direction,0,12);
   object.updateWorldMatrix(true,true);
   const hit=ray.intersectObject(object,true).find(h=>h.object.isMesh&&h.face&&h.object.visible);
   if(hit){point.copy(hit.point);normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();if(normal.dot(direction)>0)normal.negate();}
  }
  if(!normal)return;
  normal.normalize();point.addScaledVector(normal,SURFACE_IMPACT.offsetMeters);
  const effect=createBlast(point);effect.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  effect.mesh.material.side=THREE.DoubleSide;
  this.scene.add(effect.mesh,effect.sparks);this.effects.push({effect,age:0});
  if(this.effects.length>SURFACE_IMPACT.maxActive)this.remove(this.effects.shift());
 }
 remove({effect}){this.scene.remove(effect.mesh,effect.sparks);effect.dispose();}
 update(dt){for(const entry of this.effects){entry.age+=dt;entry.effect.update(entry.age);}this.effects=this.effects.filter(entry=>{if(entry.age<SURFACE_IMPACT.lifetimeSeconds)return true;this.remove(entry);return false;});}
 clear(){for(const entry of this.effects)this.remove(entry);this.effects=[];}
 dispose(){this.clear();}
}
