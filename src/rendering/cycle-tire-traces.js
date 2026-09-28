import * as THREE from 'three';
import {LIGHT_CYCLES as C} from '../game/light-cycles.js';
export const TIRE_TRACE=Object.freeze({lifetimeSeconds:8,spacingMeters:.45,widthMeters:.13,opacity:.06,
 rearContactMeters:1.23,surfaceOffsetMeters:.015,maxJumpMeters:25,capacity:8192,edgeEnvelope:3});
/** Bounded visual history only: these marks never enter trail collision state. */
export class CycleTireTraces {
 constructor(root,{arenaFloor,groundFloor,contactFor}={}){
  Object.assign(this,{arenaFloor,groundFloor,contactFor});this.anchors=new Map();this.contacts=new Map();this.cursor=0;this.lastEmit=-Infinity;
  const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  this.births=new Float32Array(TIRE_TRACE.capacity);geometry.setAttribute('traceBirth',new THREE.InstancedBufferAttribute(this.births,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
   polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8,
   uniforms:{now:{value:0},lifetime:{value:TIRE_TRACE.lifetimeSeconds},opacity:{value:TIRE_TRACE.opacity}},
   vertexShader:`attribute float traceBirth;varying float born;varying vec2 point;
    void main(){born=traceBirth;point=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform float now,lifetime,opacity;varying float born;varying vec2 point;
    void main(){float fade=max(0.,1.-max(0.,now-born)/lifetime);
     float across=(point.y-.5)*${TIRE_TRACE.edgeEnvelope.toFixed(1)};
     float pixel=max(fwidth(across),.001);
     float edge=clamp((across+.5)/pixel+.5,0.,1.)-clamp((across-.5)/pixel+.5,0.,1.);
     gl_FragColor=vec4(.48,.72,.8,opacity*fade*fade*edge);
     #include <colorspace_fragment>
    }`,
  });
  this.mesh=new THREE.InstancedMesh(geometry,material,TIRE_TRACE.capacity);this.mesh.name='Fading cycle tire traces';
  this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=1;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.geometry.attributes.traceBirth.setUsage(THREE.DynamicDrawUsage);
  // The unsampled remainder stays attached to the contact on every frame.
  const tipGeometry=geometry.clone();this.tipBirths=new Float32Array(6);
  tipGeometry.setAttribute('traceBirth',new THREE.InstancedBufferAttribute(this.tipBirths,1).setUsage(THREE.DynamicDrawUsage));
  this.tip=new THREE.InstancedMesh(tipGeometry,material,6);this.tip.name='Live tire contact traces';
  this.tip.count=0;this.tip.frustumCulled=false;this.tip.renderOrder=1;this.tip.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  this.pose=new THREE.Object3D();root.add(this.mesh,this.tip);
 }
 clear(){this.anchors.clear();this.contacts.clear();this.cursor=0;this.mesh.count=0;this.tip.count=0;this.lastEmit=-Infinity;}
 surface(x,z){
  const f=this.arenaFloor;
  return (f&&Math.abs(x)<=f.geometry.parameters.width/2&&Math.abs(z)<=f.geometry.parameters.height/2?f.position.y:this.groundFloor?.position.y??0)+TIRE_TRACE.surfaceOffsetMeters;
 }
 segmentMatrix(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  const x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  this.pose.position.set(x,this.surface(x,z),z);this.pose.rotation.set(0,-Math.atan2(dz,dx),0);this.pose.scale.set(length,1,TIRE_TRACE.widthMeters*TIRE_TRACE.edgeEnvelope);this.pose.updateMatrix();
  return this.pose.matrix;
 }
 emit(a,b,time){
  if(Math.hypot(b.x-a.x,b.z-a.z)<1e-6)return;
  this.mesh.setMatrixAt(this.cursor,this.segmentMatrix(a,b));this.births[this.cursor]=time;
  this.dirty=true;
  this.cursor=(this.cursor+1)%TIRE_TRACE.capacity;this.mesh.count=Math.min(TIRE_TRACE.capacity,this.mesh.count+1);this.lastEmit=time;
 }
 update(r){
  this.dirty=false;this.tip.count=0;
  if(!r||r.phase==='idle'){this.clear();return;}
  if(this.round!==r.round||r.time<(this.lastTime??0))this.clear();
  this.round=r.round;this.lastTime=r.time;this.mesh.material.uniforms.now.value=r.time;
  if(r.time-this.lastEmit>TIRE_TRACE.lifetimeSeconds){this.mesh.count=0;this.cursor=0;}
  for(const b of r.cycles){
   if(!b.alive||!b.escaped){this.anchors.delete(b.id);this.contacts.delete(b.id);continue;}
   const point=this.contactFor?.(b)??{x:b.x*C.cellMeters+Math.sin(b.yaw)*TIRE_TRACE.rearContactMeters,z:b.z*C.cellMeters+Math.cos(b.yaw)*TIRE_TRACE.rearContactMeters};
   let contact=this.contacts.get(b.id);
   if(!contact||Math.hypot(point.x-contact.x,point.z-contact.z)>1e-6){contact={x:point.x,z:point.z,time:r.time};this.contacts.set(b.id,contact);}
   let anchor=this.anchors.get(b.id);
   if(!anchor||Math.hypot(point.x-anchor.x,point.z-anchor.z)>TIRE_TRACE.maxJumpMeters){this.anchors.set(b.id,point);continue;}
   const distance=Math.hypot(point.x-anchor.x,point.z-anchor.z),count=Math.floor(distance/TIRE_TRACE.spacingMeters);
   for(let i=0;i<count;i++){
    const remaining=Math.hypot(point.x-anchor.x,point.z-anchor.z),f=TIRE_TRACE.spacingMeters/remaining;
    const next={x:anchor.x+(point.x-anchor.x)*f,z:anchor.z+(point.z-anchor.z)*f};this.emit(anchor,next,r.time);anchor=next;
   }
   this.anchors.set(b.id,anchor);
   if(r.time-contact.time<TIRE_TRACE.lifetimeSeconds&&Math.hypot(point.x-anchor.x,point.z-anchor.z)>1e-6){
    const slot=this.tip.count++;this.tip.setMatrixAt(slot,this.segmentMatrix(anchor,point));this.tipBirths[slot]=contact.time;
   }
  }
  if(this.dirty){this.mesh.instanceMatrix.needsUpdate=true;this.mesh.geometry.attributes.traceBirth.needsUpdate=true;}
  if(this.tip.count){this.tip.instanceMatrix.needsUpdate=true;this.tip.geometry.attributes.traceBirth.needsUpdate=true;}
 }
 get activeCount(){let count=0;for(let i=0;i<this.mesh.count;i++)if(this.lastTime-this.births[i]<TIRE_TRACE.lifetimeSeconds)count++;return count;}
 dispose(){this.clear();this.tip.removeFromParent();this.tip.geometry.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
