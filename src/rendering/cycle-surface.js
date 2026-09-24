import * as THREE from 'three';

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
