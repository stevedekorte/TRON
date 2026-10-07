import * as T from 'three';
import {subtractAll} from './wall-cut-polygons.js';
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
/** Resolve coplanar overlapping triangulations throughout the authored bike.
 * Subtract coverage already owned by a previous triangle; never remove unique area. */
export function repairCyclePanelOverlaps(scene){
 const meshes=[];scene.traverse(m=>{if(m.isMesh&&!Array.isArray(m.material)&&!m.material.transparent)meshes.push(m);});
 meshes.sort((a,b)=>Number(a.material.name==='FrontColor')-Number(b.material.name==='FrontColor'));
 scene.updateMatrixWorld(true);
 const coverage=new Map();let trimmed=0;
 for(const mesh of meshes){
  const g=mesh.geometry,p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i);
  const output=Object.fromEntries(Object.keys(g.attributes).map(k=>[k,[]]));
  const emitOriginal=tri=>{for(const i of tri)for(const [name,a] of Object.entries(g.attributes))for(let k=0;k<a.itemSize;k++)output[name].push(a.array[i*a.itemSize+k]);};
  for(let i=0;i<ids.length;i+=3){
   const tri=Array.from(ids.slice(i,i+3));
   const world=tri.map(j=>new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld));
   const normal=new T.Vector3().subVectors(world[1],world[0]).cross(new T.Vector3().subVectors(world[2],world[0]));
   if(normal.lengthSq()<1e-20){emitOriginal(tri);continue;}
   normal.normalize();
   const axis=['x','y','z'].reduce((a,b)=>Math.abs(normal[a])>Math.abs(normal[b])?a:b);
   if(normal[axis]<0)normal.negate();
   const distance=normal.dot(world[0]),axes=['x','y','z'].filter(a=>a!==axis);
   const points=world.map(v=>({x:v[axes[0]],y:v[axes[1]]})),area=cross(...points);
   if(Math.abs(area)<1e-12)continue;
   const polygon=area>0?points:[...points].reverse();
   const key=[...normal.toArray(),distance].map(n=>Math.round(n*1e5)).join(',');
   const previous=coverage.get(key)??[];
   // Verify the plane after bucketing: nearby parallel layers must remain intact.
   const cutters=previous.filter(t=>world.every(v=>Math.abs(t.normal.dot(v)-t.distance)<1e-6));
   const pieces=subtractAll([polygon],cutters.map(t=>t.polygon));
   const pieceArea=pieces.reduce((sum,poly)=>sum+Math.abs(poly.reduce((a,v,j)=>a+v.x*poly[(j+1)%poly.length].y-v.y*poly[(j+1)%poly.length].x,0)),0);
   if(pieceArea<Math.abs(area)-1e-10)trimmed++;
   for(const poly of pieces)for(let j=1;j<poly.length-1;j++){
    const t=[poly[0],poly[j],poly[j+1]];if(Math.abs(cross(...t))<1e-12)continue;
    if(area<0)t.reverse();
    for(const q of t){
     const weights=[cross(points[1],points[2],q)/area,cross(points[2],points[0],q)/area,cross(points[0],points[1],q)/area];
     for(const [name,a] of Object.entries(g.attributes))for(let k=0;k<a.itemSize;k++)output[name].push(tri.reduce((sum,id,n)=>sum+a.array[id*a.itemSize+k]*weights[n],0));
    }
   }
   previous.push({polygon,normal,distance});coverage.set(key,previous);
  }
  const next=new T.BufferGeometry();for(const [name,values] of Object.entries(output))next.setAttribute(name,new T.Float32BufferAttribute(values,g.attributes[name].itemSize));
  next.computeBoundingBox();next.computeBoundingSphere();g.dispose();mesh.geometry=next;
 }
 scene.userData.cycleOverlapRepairs=trimmed;
 return trimmed;
}
