import {Float32BufferAttribute} from 'three';

// Weld positions across material boundaries: the red trim connects otherwise
// disconnected black faces. Tag whole connected components before leg posing.
export function tagRecognizerBlocks(meshes){
 const parents=[],vertices=new Map(),triangles=[];
 const root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));
 for(const mesh of meshes){
  const old=mesh.geometry,geometry=old.index?old.toNonIndexed():old;
  if(geometry!==old){mesh.geometry=geometry;old.dispose();}
  const p=geometry.attributes.position,tags=new Float32Array(p.count);
  geometry.setAttribute('breakupBlock',new Float32BufferAttribute(tags,1));
  for(let i=0;i<p.count;i+=3){
   const id=parents.length;parents.push(id);triangles.push({geometry,i,id});
   for(let j=i;j<i+3;j++){
    const key=[p.getX(j),p.getY(j),p.getZ(j)].map(v=>Math.round(v/.001)).join(',');
    if(vertices.has(key))parents[root(id)]=root(vertices.get(key));
    else vertices.set(key,id);
   }
  }
 }
 const blocks=new Map();
 for(const {geometry,i,id} of triangles){
  const component=root(id);
  if(!blocks.has(component))blocks.set(component,blocks.size);
  for(let j=i;j<i+3;j++)geometry.attributes.breakupBlock.setX(j,blocks.get(component));
 }
 return blocks.size;
}
