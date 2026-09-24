import * as THREE from 'three';

export const ARENA_STYLE=Object.freeze({
 wallColor:0x02070c,symbolColor:0x290649,
 wallEdgeColor:0x29434c,symbolEdgeColor:0x634179,
 edgeThresholdDegrees:20,wallEdgeOpacity:.8,symbolEdgeOpacity:.9,
});
// Presentation adapter: keep authored geometry and the source GLB unchanged.
// EdgesGeometry removes coplanar triangle diagonals while retaining silhouettes.
export function styleArena(root,options={}){
 const c={...ARENA_STYLE,...options},records=[],meshes=[];
 root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){
  const originals=[].concat(mesh.material);
  const symbol=originals.every(m=>m.name==='_23');
  const materials=originals.map(original=>{
   const material=new THREE.MeshBasicMaterial({color:original.name==='_23'?c.symbolColor:c.wallColor,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
   material.name=original.name;return material;
  });
  const old=mesh.material;mesh.material=Array.isArray(old)?materials:materials[0];
  const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,c.edgeThresholdDegrees),new THREE.LineBasicMaterial({color:symbol?c.symbolEdgeColor:c.wallEdgeColor,transparent:true,opacity:symbol?c.symbolEdgeOpacity:c.wallEdgeOpacity,depthTest:true,depthWrite:false,toneMapped:false}));
  lines.name=symbol?'Arena_symbol_outline':'Arena_wall_outline';lines.renderOrder=1;
  mesh.add(lines);records.push({mesh,old,materials,lines});
 }
 return {edgeSegments:records.reduce((n,r)=>n+r.lines.geometry.attributes.position.count/2,0),dispose(){
  for(const {mesh,old,materials,lines} of records){mesh.material=old;materials.forEach(m=>m.dispose());lines.removeFromParent();lines.geometry.dispose();lines.material.dispose();}records.length=0;
 }};
}
