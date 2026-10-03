import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPlanarShuttle,PLANAR_SHUTTLE as C} from '../src/rendering/shuttle-planar.js';
test('shuttle has X/Y symmetry and only its front corners have non-axis-aligned faces',()=>{
 const model=createPlanarShuttle();model.updateMatrixWorld(true);
 const points=new Set(),all=[];
 const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*10000)).join(',');
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);v.y-=4;
   points.add(key(v.x,v.y,v.z));all.push(v);
  }
  for(let i=0;i<p.count;i+=3){
   const a=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),b=new T.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld),c=new T.Vector3().fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);
   const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
   if(n.lengthSq()<.1||Math.max(Math.abs(n.x),Math.abs(n.y),Math.abs(n.z))>.9999)continue;
   for(const v of [a,b,c]){
    assert(v.z<=-C.depth/2+C.cornerRadius+1e-4,'angled face outside front');
    assert(Math.abs(v.x)>=C.width/2-C.cornerRadius-1e-4,'angled face away from corners');
   }
  }
 });
 for(const v of all){assert(points.has(key(-v.x,v.y,v.z)));assert(points.has(key(v.x,-v.y,v.z)));}
});
