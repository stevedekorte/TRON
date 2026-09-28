import * as T from 'three';
import {styleArena} from './arena-style.js';
import {ARENA_WALL} from '../game/arena-breaches.js';
// Clip a polygon by a half-space n·p <= d. Runs only when a wall is breached.
function clip(poly,n,d,inside){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=n.dot(a)-d,db=n.dot(b)-d;
  const keepA=inside?da<=0:da>=0,keepB=inside?db<=0:db>=0;
  if(keepA)out.push(a);
  if(keepA!==keepB)out.push(a.clone().lerp(b,da/(da-db)));
 }
 return out;
}
function subtract(poly,planes){
 // A polygon outside (or touching) any prism face needs no subdivision.
 // This also prevents coplanar triangles being duplicated at shared slab edges.
 if(planes.some(([n,d])=>poly.every(p=>n.dot(p)-d>=-1e-7)))return [poly];
 const pieces=[];let remaining=poly;
 for(const [n,d] of planes){
  if(remaining.length<3)break;
  const outside=clip(remaining,n,d,false);if(outside.length>=3)pieces.push(outside);
  remaining=clip(remaining,n,d,true);
 }
 return pieces;
}
export function breachVolumes(b,profiles=[ARENA_WALL.profile,...ARENA_WALL.branches]){
 const normal=b.axis==='x'?new T.Vector3(b.sign,0,0):new T.Vector3(0,0,b.sign);
 const along=b.axis==='x'?new T.Vector3(0,0,1):new T.Vector3(1,0,0);
 const volumes=[];
 for(const profile of profiles)for(let i=1;i<profile.length;i++){
  const [y0,o0,w0]=profile[i-1],[y1,o1,w1]=profile[i];
  const left0=b.along+o0-w0,right0=b.along+o0+w0;
  const leftSlope=(o1-w1-o0+w0)/(y1-y0),rightSlope=(o1+w1-o0-w0)/(y1-y0);
  volumes.push([[normal,ARENA_WALL.outerMeters+2],[normal.clone().negate(),-(ARENA_WALL.innerMeters-5)],
   [new T.Vector3(0,1,0),y1],[new T.Vector3(0,-1,0),-y0],
   [along.clone().add(new T.Vector3(0,-rightSlope,0)),right0-rightSlope*y0],
   [along.clone().negate().add(new T.Vector3(0,leftSlope,0)),-left0+leftSlope*y0]]);
 }
 return volumes;
}
export function cutBreachGeometry(geometry,matrix,breach,profiles){
 const positions=geometry.attributes.position,index=geometry.index,volumes=breachVolumes(breach,profiles),inverse=matrix.clone().invert();
 const output=[],groups=[];let offset=0;
 const sourceGroups=geometry.groups.length?geometry.groups:[{start:0,count:index?.count??positions.count,materialIndex:0}];
 for(const group of sourceGroups){
  const start=offset;
  for(let i=group.start;i<group.start+group.count;i+=3){
   let pieces=[Array.from({length:3},(_,j)=>new T.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(matrix))];
   for(const volume of volumes)pieces=pieces.flatMap(poly=>subtract(poly,volume));
   for(const poly of pieces)for(let j=1;j<poly.length-1;j++)for(const p of [poly[0],poly[j],poly[j+1]]){output.push(...p.clone().applyMatrix4(inverse).toArray());offset++;}
  }
  groups.push({start,count:offset-start,materialIndex:group.materialIndex});
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(output,3));
 for(const g of groups)result.addGroup(g.start,g.count,g.materialIndex);
 result.computeVertexNormals();result.computeBoundingSphere();return result;
}
function fractureLining(b,profile){
 const positions=[],point=(normal,y,along)=>b.axis==='x'?[normal*b.sign,y,along]:[along,y,normal*b.sign];
 for(const side of [-1,1])for(let i=1;i<profile.length;i++){
  const [y0,o0,w0]=profile[i-1],[y1,o1,w1]=profile[i];
  const a=point(ARENA_WALL.innerMeters,y0,b.along+o0+side*w0),c=point(ARENA_WALL.innerMeters,y1,b.along+o1+side*w1);
  const d=point(ARENA_WALL.outerMeters,y1,b.along+o1+side*w1),e=point(ARENA_WALL.outerMeters,y0,b.along+o0+side*w0);
  positions.push(...a,...c,...d,...a,...d,...e);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
/** Cuts the actual inner/symbol/outer meshes and regenerates their edge lines. */
export class ArenaBreaches {
 constructor(architecture,style){this.root=architecture;this.style=style;this.round=null;this.count=0;this.linings=[];this.originals=new Map();architecture.traverse(o=>{if(o.isMesh)this.originals.set(o,o.geometry);});}
 update(race){
  if(!race)return;
  if(this.round!==race.round){this.restore();this.round=race.round;}
  const pending=race.breaches.slice(this.count);if(!pending.length)return;
  this.root.updateWorldMatrix(true,true);const inverse=this.root.matrixWorld.clone().invert();
  for(const b of pending)for(const [mesh,original] of this.originals){
   const matrix=inverse.clone().multiply(mesh.matrixWorld);
   const next=cutBreachGeometry(mesh.geometry,matrix,b);
   if(mesh.geometry!==original)mesh.geometry.dispose();mesh.geometry=next;
  }
  this.clearLinings();
  for(const b of race.breaches){
   const profiles=[ARENA_WALL.profile,...ARENA_WALL.branches],positions=[];
   // Remove surfaces buried inside another branch so the passage is one opening.
   for(const profile of profiles){
    let part=fractureLining(b,profile);
    const cut=cutBreachGeometry(part,new T.Matrix4(),b,profiles.filter(p=>p!==profile));part.dispose();
    positions.push(...cut.attributes.position.array);cut.dispose();
   }
   let geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
   for(const other of race.breaches)if(other!==b){const next=cutBreachGeometry(geometry,new T.Matrix4(),other);geometry.dispose();geometry=next;}
   const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());
   mesh.name='Exposed_arena_fracture';mesh.userData.fractureStyle=styleArena(mesh);this.root.add(mesh);this.linings.push(mesh);
  }
  this.count=race.breaches.length;this.style.refreshEdges();
 }
 clearLinings(){for(const mesh of this.linings){mesh.removeFromParent();mesh.userData.fractureStyle.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.linings=[];}
 restore(){this.clearLinings();for(const [mesh,original] of this.originals){if(mesh.geometry!==original)mesh.geometry.dispose();mesh.geometry=original;}this.count=0;this.style.refreshEdges();}
 dispose(){this.restore();}
}
