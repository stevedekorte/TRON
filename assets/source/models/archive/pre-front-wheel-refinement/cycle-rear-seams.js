import * as T from 'three';

// Bounds of the authored rear return, in source-model meters.
export const CYCLE_REAR_RETURN=Object.freeze({minX:.084,maxX:.1131,minZ:.255,maxZ:.2851,bottom:.217697,topMin:.418});
export function repairCycleRearSeams(scene){
 const C=CYCLE_REAR_RETURN,additions=[];
 scene.traverse(mesh=>{
  if(!mesh.isMesh||!['Color_D06','Color_I03','_6'].includes(mesh.material.name))return;
  const g=mesh.geometry,p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
  const inStrip=i=>Math.abs(p.getX(i))>=C.minX&&Math.abs(p.getX(i))<=C.maxX&&p.getZ(i)>=C.minZ&&p.getZ(i)<=C.maxZ&&p.getY(i)>=C.bottom-1e-6&&p.getY(i)<.437;
  const strips=[-1,1].map(sign=>{
   const top=new Map(),bottom=new Map();
   for(let i=0;i<p.count;i++)if(inStrip(i)&&Math.sign(p.getX(i))===sign){
    const x=Math.abs(p.getX(i)),y=p.getY(i),z=p.getZ(i);
    if(y>C.topMin)top.set(x,{x,y,z});
    if(Math.abs(y-C.bottom)<1e-6)bottom.set(x,{x,y,z});
   }
   return {sign,top:[...top.values()].sort((a,b)=>a.x-b.x),bottom:[...bottom.values()].sort((a,b)=>a.x-b.x)};
  }).filter(s=>s.top.length>5&&s.bottom.length>5);
  if(!strips.length)return;
  for(let i=0;i<ids.length;i+=3){const tri=Array.from(ids.slice(i,i+3));
   // Keep the adjoining planar side face at the outermost x boundary.
   const strip=strips.find(s=>tri.every(j=>inStrip(j)&&Math.sign(p.getX(j))===s.sign));
   if(!strip||tri.every(j=>Math.abs(Math.abs(p.getX(j))-strip.top.at(-1).x)<1e-7))keep.push(...tri);
  }
  g.setIndex(keep);
  for(const {sign,top,bottom} of strips){
   const xs=[...new Set([...top,...bottom].map(v=>v.x))].sort((a,b)=>a-b);
   const sample=(row,x)=>{
    const hi=row.findIndex(v=>v.x>=x);if(hi<=0)return {...row[hi<0?row.length-1:0],x};
    const a=row[hi-1],b=row[hi],t=(x-a.x)/(b.x-a.x);return {x,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
   };
   const positions=[],indices=[];
   for(const x of xs)for(const row of [bottom,top]){const v=sample(row,x);positions.push(sign*x,v.y,v.z);}
   for(let j=0;j<xs.length-1;j++){const a=j*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const patch=new T.Mesh(geometry,mesh.material);patch.name='Sealed rear body return';patch.position.copy(mesh.position);patch.quaternion.copy(mesh.quaternion);patch.scale.copy(mesh.scale);additions.push({parent:mesh.parent,patch});
  }
 });
 for(const {parent,patch} of additions)parent.add(patch);
 return additions.length;
}

/** Flat plates contain backward-facing sliver triangles. Align winding and
 * normals together so DoubleSide lighting cannot expose their diagonals. */
export function repairCyclePanelWinding(scene){
 scene.traverse(mesh=>{
  if(!mesh.isMesh||!['_LightGray_1','FrontColor','Color_D06','Color_I03','_6'].includes(mesh.material.name))return;
  const old=mesh.geometry,g=old.index?old.toNonIndexed():old,p=g.attributes.position,n=g.attributes.normal;
  if(!n)return;
  for(let i=0;i<p.count;i+=3){const x=p.getX(i);
   const plate=Math.abs(Math.abs(x)-.0841)<.0001,panel=Math.abs(Math.abs(x)-.11295)<.00002;
   if((!plate&&!panel)||![i+1,i+2].every(j=>Math.abs(p.getX(j)-x)<1e-6))continue;
   const area=(p.getY(i+1)-p.getY(i))*(p.getZ(i+2)-p.getZ(i))-(p.getZ(i+1)-p.getZ(i))*(p.getY(i+2)-p.getY(i));
   if(Math.sign(area)!==Math.sign(x))for(const a of Object.values(g.attributes))for(let k=0;k<a.itemSize;k++){const one=(i+1)*a.itemSize+k,two=(i+2)*a.itemSize+k,v=a.array[one];a.array[one]=a.array[two];a.array[two]=v;}
   for(let j=i;j<i+3;j++)n.setXYZ(j,Math.sign(x),0,0);
  }
  if(g!==old){mesh.geometry=g;old.dispose();}for(const a of Object.values(g.attributes))a.needsUpdate=true;
 });
}
