import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const CYCLE_SURFACE = Object.freeze({
  creaseRadians: Math.PI / 4, smoothingPasses: 3,
  smoothWeight: .5, restoreWeight: -.53,
});
/** Repair quantized curved OBJ surfaces without moving seams or authored sharp edges. */
export function repairCycleSurface(source) {
  const geometry=source.clone(),position=geometry.attributes.position,normal=geometry.attributes.normal;
  const vertices=[],lookup=new Map(),mapping=[];
  for(let i=0;i<position.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(position,i);
    const key=point.toArray().map(v=>v.toFixed(6)).join(',');
    if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push({point,neighbors:new Set(),normals:[],locked:false});}
    const id=lookup.get(key);mapping.push(id);
    if(normal)vertices[id].normals.push(new THREE.Vector3().fromBufferAttribute(normal,i));
  }
  const indices=[],seen=new Set(),edges=new Map();
  const index=source.index?.array??Array.from({length:position.count},(_,i)=>i);
  for(let i=0;i<index.length;i+=3){
    const face=Array.from(index.slice(i,i+3)),ids=face.map(v=>mapping[v]);
    const key=[...ids].sort((a,b)=>a-b).join(',');
    if(new Set(ids).size<3||seen.has(key))continue;
    seen.add(key);indices.push(...face);
    for(let j=0;j<3;j++){
      const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
      edges.set(key,(edges.get(key)??0)+1);vertices[a].neighbors.add(b);vertices[b].neighbors.add(a);
    }
  }
  for(const [key,count] of edges)if(count!==2)for(const id of key.split(',').map(Number))vertices[id].locked=true;
  const cosine=Math.cos(CYCLE_SURFACE.creaseRadians);
  for(const v of vertices)if(v.normals.some(n=>v.normals.some(m=>n.dot(m)<cosine)))v.locked=true;
  // These authored flat side panels must stay planar: smoothing their shared
  // diagonal into the adjoining curved shell opens a hairline/shadow crease.
  for(const v of vertices)if(Math.abs(Math.abs(v.point.x)-.11295)<.00002&&v.point.y>.21&&v.point.y<.64&&v.point.z>-.36&&v.point.z<.44)v.locked=true;
  for(const v of vertices)if(Math.abs(Math.abs(v.point.x)-.0841)<.0001)v.locked=true;
  for(const v of vertices)if(Math.abs(v.point.x)>.084&&Math.abs(v.point.x)<.1131&&v.point.z>=.255&&v.point.z<=.2851&&v.point.y>=.217696&&v.point.y<.437)v.locked=true;
  // Paired smoothing/inflation reduces export stair steps without shrinking wheels.
  for(let pass=0;pass<CYCLE_SURFACE.smoothingPasses;pass++)for(const weight of [CYCLE_SURFACE.smoothWeight,CYCLE_SURFACE.restoreWeight]){
    const next=vertices.map(v=>{
      if(v.locked||!v.neighbors.size)return v.point.clone();
      const mean=new THREE.Vector3();for(const id of v.neighbors)mean.add(vertices[id].point);
      return v.point.clone().lerp(mean.multiplyScalar(1/v.neighbors.size),weight);
    });
    vertices.forEach((v,i)=>v.point=next[i]);
  }
  for(let i=0;i<position.count;i++){const p=vertices[mapping[i]].point;position.setXYZ(i,p.x,p.y,p.z);}
  geometry.setIndex(indices);
  // Keep the authored smooth normals: recomputing them from rounded OBJ positions
  // exaggerates the tiny staircase faces on the wheel hubs.
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** The OBJ rounds these small hubs to centimeter steps. Rebuild their curved caps
 * at the measured source dimensions rather than displaying cracked sliver faces. */
export function repairCycleHubs(scene) {
  const hubs=[
    {x:.09965,y:.25455,z:-.56494,rx:.0561,r:.0515},
    {x:-.09965,y:.25455,z:-.56494,rx:.0561,r:.0515},
    {x:0,y:.25455,z:.56494,rx:.0586,r:.0515},
  ];
  let material;
  scene.traverse(mesh=>{
    if(!mesh.isMesh||!['_LightGray_1','FrontColor'].includes(mesh.material.name))return;
    if(mesh.material.name==='_LightGray_1')material=mesh.material;
    const geometry=mesh.geometry,p=geometry.attributes.position,ids=geometry.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
    for(let i=0;i<ids.length;i+=3){
      const face=Array.from(ids.slice(i,i+3));
      const inside=hubs.some(h=>face.every(v=>Math.abs(p.getX(v)-h.x)<=h.rx+.001&&Math.hypot(p.getY(v)-h.y,p.getZ(v)-h.z)<=h.r+.006));
      if(!inside)keep.push(...face);
    }
    geometry.setIndex(keep);
  });
  if(!material)return;
  const geometry=new THREE.SphereGeometry(1,48,24);
  for(const h of hubs){
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Repaired smooth wheel hub';
    mesh.position.set(h.x,h.y,h.z);mesh.scale.set(h.rx,h.r,h.r);scene.add(mesh);
  }
}

/** Omit the source's separate extruded signature/date lettering from the bike.
 * Attribution remains in the credits and source asset metadata. */
export function removeCycleInscriptions(scene){
 const inscriptions=[];
 scene.traverse(o=>{if(o.isMesh&&/daniel_preti/i.test(o.name))inscriptions.push(o);});
 for(const mesh of inscriptions){mesh.removeFromParent();mesh.geometry.dispose();}
 return inscriptions.length;
}

export const CYCLE_MATERIAL_LIGHTING=Object.freeze({roughness:.4,metalness:.15,ambientScale:.35});
export function applyCycleMaterialLighting(scene){
 const materials=new Set();scene.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>materials.add(m));});
 for(const material of materials){
  if(!material.userData.cycleRim){material.roughness=CYCLE_MATERIAL_LIGHTING.roughness;material.metalness=CYCLE_MATERIAL_LIGHTING.metalness;}
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight -= reflectedLight.indirectDiffuse * ${1-CYCLE_MATERIAL_LIGHTING.ambientScale};\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>`cycle-directional-${CYCLE_MATERIAL_LIGHTING.ambientScale}`;
 }
}

export const CYCLE_REAR_WHEEL=Object.freeze({enabled:true,radialSegments:128,profileSegments:64,centerY:.2545485,centerZ:.56});
/** Replace only the separately authored rear tire ring. Preserve spokes and hubs. */
export function refineCycleRearWheel(scene){
 if(!CYCLE_REAR_WHEEL.enabled)return;
 const candidates=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.name==='Refined rear wheel ring')return;
  mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,size=b.getSize(new THREE.Vector3());
  if(b.min.z>.30&&size.z>.49&&size.z<.53&&size.y>.49&&size.y<.53&&size.x>.06&&size.x<.08)candidates.push(mesh);
 });
 for(const mesh of candidates){
  // Measured axial/radial profile: a thin crown and broad rounded sidewalls.
  const half=[[.0106,.164],[.023,.164],[.0358,.172],[.03645,.18],[.033,.20],[.027,.22],[.019,.24],[.010,.250],[.005,.25117]];
  const profile=[...half.map(([x,r])=>new THREE.Vector3(r,-x,0)),...half.slice().reverse().map(([x,r])=>new THREE.Vector3(r,x,0))];
  const curve=new THREE.CatmullRomCurve3(profile,true,'centripetal');
  const points=curve.getPoints(CYCLE_REAR_WHEEL.profileSegments).map(p=>new THREE.Vector2(p.x,p.y));
  const geometry=new THREE.LatheGeometry(points,CYCLE_REAR_WHEEL.radialSegments);
  geometry.rotateZ(Math.PI/2);geometry.translate(0,CYCLE_REAR_WHEEL.centerY,CYCLE_REAR_WHEEL.centerZ);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  mesh.geometry.dispose();mesh.geometry=geometry;mesh.name='Refined rear wheel ring';
 }
 return candidates.length;
}

export const CYCLE_WHEEL_INTERIORS=Object.freeze({radius:.164,segments:128,centerY:.2545485,frontZ:-.56,rearZ:.56,frontX:.10545,frontThickness:.018,rearThickness:.025,rearSilverWidth:.0212,capClearance:.0003});
/** The dark wheel inserts contain overlapping quantized discs. Replace those
 * circular liners only; retain the inset faces, spokes and hub caps. */
export function refineCycleWheelInteriors(scene){
 const C=CYCLE_WHEEL_INTERIORS,groups={front:[],rear:[]};
 scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.name!=='black'||mesh.userData.refinedWheelInterior)return;
  mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,s=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
  if(s.x>.04||s.y<.30||s.y>.35||s.z<.30||s.z>.35||Math.abs(center.y-C.centerY)>.01)return;
  if(Math.abs(center.z-C.frontZ)<.01)groups.front.push(mesh);
  if(Math.abs(center.z-C.rearZ)<.01)groups.rear.push(mesh);
 });
 let count=0;
 for(const [end,meshes] of Object.entries(groups)){
  if(!meshes.length)continue;
  const material=meshes[0].material,front=end==='front';
  // The silver rear liner owns the middle span; black end bands must not
  // occupy that same cylindrical surface (which flickers as the view moves).
  let geometry;
  if(front)geometry=new THREE.CylinderGeometry(C.radius,C.radius,C.frontThickness,C.segments,1,true);
  else{
   const width=(C.rearThickness-C.rearSilverWidth)/2;
   const bands=[-1,1].map(side=>{const g=new THREE.CylinderGeometry(C.radius,C.radius,width,C.segments,1,true);g.translate(0,side*(C.rearSilverWidth+width)/2,0);return g;});
   geometry=mergeGeometries(bands);bands.forEach(g=>g.dispose());
  }
  geometry.rotateZ(Math.PI/2);
  for(const x of front?[-C.frontX,C.frontX]:[0]){
   const mesh=new THREE.Mesh(geometry,material);mesh.name=`Smooth ${end} wheel interior`;mesh.userData.refinedWheelInterior=true;
   mesh.position.set(x,C.centerY,front?C.frontZ:C.rearZ);scene.add(mesh);count++;
   const depth=front?C.frontThickness:C.rearThickness;
   for(const side of [-1,1]){
    const capGeometry=new THREE.CircleGeometry(C.radius,C.segments);capGeometry.rotateY(side*Math.PI/2);
    const cap=new THREE.Mesh(capGeometry,material);cap.name='Smooth black wheel face';cap.userData.cycleWheelCap=true;
    cap.position.set(x+side*(depth/2+C.capClearance),C.centerY,front?C.frontZ:C.rearZ);scene.add(cap);
   }
  }
  for(const mesh of meshes){
   const g=mesh.geometry,p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
   const z=front?C.frontZ:C.rearZ;
   const radii=Array.from({length:p.count},(_,i)=>Math.hypot(p.getY(i)-C.centerY,p.getZ(i)-z));
   for(let i=0;i<ids.length;i+=3){const tri=Array.from(ids.slice(i,i+3));if(!tri.every(j=>radii[j]>.153))keep.push(...tri);}
   for(let i=0;i<p.count;i++)if(radii[i]>.153){const scale=C.radius/radii[i];p.setXYZ(i,p.getX(i),C.centerY+(p.getY(i)-C.centerY)*scale,z+(p.getZ(i)-z)*scale);}
   p.needsUpdate=true;g.setIndex(keep);g.computeBoundingBox();g.computeBoundingSphere();
  }
 }
 return count;
}

/** Remove the authored gray hub-to-tire highlight strips. Keep the hubs and
 * rebuild only the rear circular liner, which receives the black rim finish. */
export function removeCycleWheelHighlights(scene){
 const W=CYCLE_WHEEL_INTERIORS,rear=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.name==='Repaired smooth wheel hub'||!['FrontColor','Color_000'].includes(mesh.material.name))return;
  const g=mesh.geometry,p=g.attributes.position;g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new THREE.Vector3());
  if(b.min.z>.38&&size.x<.025&&size.y>.30&&size.y<.35&&size.z>.30&&size.z<.35){rear.push(mesh);return;}
  const ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
  const highlight=i=>{
   const x=Math.abs(p.getX(i)),y=p.getY(i)-W.centerY,z=p.getZ(i)-W.frontZ;
   return x>.085&&x<.12&&y<.001&&z<.001&&Math.hypot(y,z)<.18;
  };
  for(let i=0;i<ids.length;i+=3){const tri=Array.from(ids.slice(i,i+3));if(!tri.every(highlight))keep.push(...tri);}
  g.setIndex(keep);
 });
 for(const mesh of rear){
  const linerGeometry=new THREE.CylinderGeometry(W.radius,W.radius,W.rearSilverWidth,W.segments,1,true);linerGeometry.rotateZ(Math.PI/2);
  const liner=new THREE.Mesh(linerGeometry,mesh.material);liner.name='Smooth rear silver liner';liner.position.set(0,W.centerY,W.rearZ);mesh.parent.add(liner);
  mesh.removeFromParent();mesh.geometry.dispose();
 }
 return rear.length;
}


export const CYCLE_RIM_MATERIAL=Object.freeze({color:0x080b10,roughness:.08,metalness:.5,clearcoat:1,clearcoatRoughness:.04});
/** Keep the outer wheel shells in their authored team paint. Only the already
 * black wheel inserts receive the dark finish with lighting-based reflections. */
export function applyCycleBlackRims(scene){
 const material=new THREE.MeshPhysicalMaterial({...CYCLE_RIM_MATERIAL,side:THREE.DoubleSide});
 material.name='Reflective black inner cycle rim';material.userData.cycleRim=true;
 const additions=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.name==='Smooth rear silver liner'){mesh.material=material;return;}
  // Split only the inward-facing narrow annulus, including the source's light
  // highlight faces. Keep the outer sidewalls and hubs painted.
  if(['Color_D06','Color_I03','_6','Color_A01','Color_A03','FrontColor'].includes(mesh.material.name)){
   const g=mesh.geometry,p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),inner=[],outer=[];
   for(let i=0;i<ids.length;i+=3){
    const tri=Array.from(ids.slice(i,i+3));
    const onInner=[-.56,.56].some(z=>{
     if(!tri.every(j=>{const r=Math.hypot(p.getY(j)-CYCLE_WHEEL_INTERIORS.centerY,p.getZ(j)-z);return r>.153&&r<.267;}))return false;
     const n=g.attributes.normal;if(!n)return false;
     const radial=new THREE.Vector3(0,tri.reduce((sum,j)=>sum+p.getY(j),0)/3-CYCLE_WHEEL_INTERIORS.centerY,tri.reduce((sum,j)=>sum+p.getZ(j),0)/3-z).normalize();
     const normal=new THREE.Vector3();tri.forEach(j=>normal.add(new THREE.Vector3().fromBufferAttribute(n,j)));normal.normalize();
     return normal.dot(radial)<-.25;
    });
    (onInner?inner:outer).push(...tri);
   }
   if(inner.length){const part=g.clone();part.setIndex(inner);g.setIndex(outer);const ring=new THREE.Mesh(part,material);ring.name='Black inner rim surface';ring.position.copy(mesh.position);ring.quaternion.copy(mesh.quaternion);ring.scale.copy(mesh.scale);additions.push({parent:mesh.parent,ring});}
  }
  if(mesh.material.name!=='black')return;
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const wheelInsert=size.x<.04&&size.y>.30&&size.y<.35&&size.z>.30&&size.z<.35&&Math.abs(center.y-CYCLE_WHEEL_INTERIORS.centerY)<.01&&Math.abs(Math.abs(center.z)-.56)<.01;
  if(wheelInsert||mesh.userData.refinedWheelInterior||mesh.userData.cycleWheelCap)mesh.material=material;
 });
 for(const {parent,ring} of additions)parent.add(ring);
}
