import * as T from 'three';

// Source-model meters, measured from the lower, unobstructed wheel cross section.
export const CYCLE_FRONT_WHEEL=Object.freeze({enabled:true,centerY:.2545485,centerZ:-.56,radialSegments:128,profileSegments:64,
 halfProfile:[[.1128,.164],[.1815,.181],[.155,.202],[.1273,.221],[.0975,.234],[.0658,.246],[.0332,.253],[0,.2555]]});

export function refineCycleFrontWheel(scene){
 const C=CYCLE_FRONT_WHEEL;if(!C.enabled)return 0;
 let material;let removed=0;
 scene.traverse(mesh=>{
  if(!mesh.isMesh||!['Color_D06','Color_I03','_6','Color_A01','Color_A03'].includes(mesh.material.name))return;
  const g=mesh.geometry,p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),keep=[];
  const onWheel=i=>{const y=p.getY(i),z=p.getZ(i),r=Math.hypot(y-C.centerY,z-C.centerZ);return z<-.30&&y<.516&&r>.15&&r<.27;};
  let count=0;
  for(let i=0;i<ids.length;i+=3){const tri=Array.from(ids.slice(i,i+3));if(tri.every(onWheel))count++;else keep.push(...tri);}
  if(count){g.setIndex(keep);removed+=count;if(!material||['Color_D06','Color_I03'].includes(mesh.material.name))material=mesh.material;}
 });
 if(!material)return 0;
 const half=C.halfProfile,profile=[...half.map(([x,r])=>new T.Vector3(r,-x,0)),...half.slice(0,-1).reverse().map(([x,r])=>new T.Vector3(r,x,0))];
 const curve=new T.CatmullRomCurve3(profile,true,'centripetal');
 const geometry=new T.LatheGeometry(curve.getPoints(C.profileSegments).map(p=>new T.Vector2(p.x,p.y)),C.radialSegments);
 geometry.rotateZ(Math.PI/2);geometry.translate(0,C.centerY,C.centerZ);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const wheel=new T.Mesh(geometry,material);wheel.name='Refined front wheel ring';scene.add(wheel);
 return removed;
}
