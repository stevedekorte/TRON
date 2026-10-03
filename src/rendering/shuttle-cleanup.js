import * as T from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

export const SHUTTLE_CLEANUP=Object.freeze({iterations:80,lambda:.5,mu:-.53,weldPrecision:10000,creaseAngleRadians:Math.PI/3,planeToleranceFraction:.015,planeNormalThreshold:.9,minPlaneVertices:60});
/** Smooth welded geometry, retain one quadrant, then mirror across width/height. */
export function cleanShuttleGeometry(input,options={}){
 const settings={...SHUTTLE_CLEANUP,...options};
 const geometry=input.index?input.toNonIndexed():input.clone();
 const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 const vertices=[],ids=[],lookup=new Map(),neighbors=[];
 for(let i=0;i<pos.count;i++){
  const p=[pos.getX(i),pos.getY(i),pos.getZ(i)],key=p.map(v=>Math.round(v*settings.weldPrecision)).join(',');
  let id=lookup.get(key);
  if(id===undefined){id=vertices.length;lookup.set(key,id);vertices.push(p);neighbors.push(new Set());}ids.push(id);
 }
 for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){
  const a=ids[i+j],b=ids[i+(j+1)%3];neighbors[a].add(b);neighbors[b].add(a);
 }
 function relax(weight){
  const next=vertices.map((p,i)=>{
   const ns=[...neighbors[i]];if(!ns.length)return p;
   return p.map((v,axis)=>v+weight*(ns.reduce((sum,n)=>sum+vertices[n][axis],0)/ns.length-v));
  });for(let i=0;i<vertices.length;i++)vertices[i]=next[i];
 }
 for(let i=0;i<settings.iterations;i++){relax(settings.lambda);relax(settings.mu);}
 const bounds=new T.Box3();for(const p of vertices)bounds.expandByPoint(new T.Vector3(...p));
 // Consolidate broad, nearly axis-aligned panels into actual planes.
 const normals=vertices.map(()=>new T.Vector3());
 for(let i=0;i<ids.length;i+=3){
  const a=new T.Vector3(...vertices[ids[i]]),b=new T.Vector3(...vertices[ids[i+1]]),c=new T.Vector3(...vertices[ids[i+2]]);
  const n=b.sub(a).cross(c.sub(a));for(let j=0;j<3;j++)normals[ids[i+j]].add(n);
 }
 for(const n of normals)n.normalize();
 for(let axis=0;axis<3;axis++){
  const tolerance=bounds.getSize(new T.Vector3()).getComponent(axis)*settings.planeToleranceFraction;
  const remaining=new Set(vertices.map((_,i)=>i).filter(i=>Math.abs(normals[i].getComponent(axis))>settings.planeNormalThreshold));
  while(remaining.size>=settings.minPlaneVertices){
   const ordered=[...remaining].sort((a,b)=>vertices[a][axis]-vertices[b][axis]);
   let bestStart=0,bestEnd=0,start=0;
   for(let end=0;end<ordered.length;end++){
    while(vertices[ordered[end]][axis]-vertices[ordered[start]][axis]>tolerance)start++;
    if(end-start>bestEnd-bestStart){bestStart=start;bestEnd=end;}
   }
   if(bestEnd-bestStart+1<settings.minPlaneVertices)break;
   const group=ordered.slice(bestStart,bestEnd+1),plane=group.reduce((sum,i)=>sum+vertices[i][axis],0)/group.length;
   for(const i of group){vertices[i][axis]=plane;remaining.delete(i);}
  }
 }
 const center=bounds.getCenter(new T.Vector3());
 function clip(poly,axis){
  const result=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],insideA=a.p[axis]>=0,insideB=b.p[axis]>=0;
   if(insideA)result.push(a);
   if(insideA!==insideB){const t=a.p[axis]/(a.p[axis]-b.p[axis]);
    const p=a.p.map((v,k)=>v+(b.p[k]-v)*t);p[axis]=0;
    result.push({p,uv:a.uv.map((v,k)=>v+(b.uv[k]-v)*t)});
   }
  }return result;
 }
 const positions=[],uvs=[];
 for(let i=0;i<ids.length;i+=3){
  let poly=[0,1,2].map(j=>({p:vertices[ids[i+j]].map((v,k)=>v-center.getComponent(k)),uv:uv?[uv.getX(i+j),uv.getY(i+j)]:[0,0]}));
  poly=clip(clip(poly,0),1);
  for(let j=1;j<poly.length-1;j++)for(const sx of [-1,1])for(const sy of [-1,1]){
   const tri=[poly[0],poly[j],poly[j+1]];if(sx*sy<0)tri.reverse();
   for(const v of tri){positions.push(v.p[0]*sx,v.p[1]*sy,v.p[2]);uvs.push(...v.uv);}
  }
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.dispose();return toCreasedNormals(result,settings.creaseAngleRadians);
}
