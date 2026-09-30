import * as THREE from 'three';
import {arenaEdges} from './arena-edges.js';

export const ARENA_STYLE=Object.freeze({
 wallColor:0x02070c,symbolColor:0x61249b,
 wallTopColor:0x343548,wallTopMinHeightMeters:49,
 wallEdgeColor:0x29434c,symbolEdgeColor:0x9c6bbe,
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
   // Shade only upward-facing ledges at the wall crest. The shader also
   // survives breach geometry replacement without owning another mesh.
   if(original.name!=='_23')material.onBeforeCompile=shader=>{
    shader.uniforms.arenaTopColor={value:new THREE.Color(c.wallTopColor)};
    shader.uniforms.arenaTopMinHeight={value:c.wallTopMinHeightMeters};
    shader.vertexShader='varying vec3 arenaSurfaceNormal; varying float arenaSurfaceHeight;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     arenaSurfaceNormal=normalize(mat3(modelMatrix)*normal);
     arenaSurfaceHeight=(modelMatrix*vec4(position,1.)).y;`);
    shader.fragmentShader='uniform vec3 arenaTopColor; uniform float arenaTopMinHeight; varying vec3 arenaSurfaceNormal; varying float arenaSurfaceHeight;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     if(abs(normalize(arenaSurfaceNormal).y)>.95 && arenaSurfaceHeight>=arenaTopMinHeight) diffuseColor.rgb=arenaTopColor;`);
   };
   material.name=original.name;return material;
  });
  const old=mesh.material;mesh.material=Array.isArray(old)?materials:materials[0];
  const lines=new THREE.LineSegments(arenaEdges(mesh.geometry,c.edgeThresholdDegrees),new THREE.LineBasicMaterial({color:symbol?c.symbolEdgeColor:c.wallEdgeColor,transparent:true,opacity:symbol?c.symbolEdgeOpacity:c.wallEdgeOpacity,depthTest:true,depthWrite:false,toneMapped:false}));
  lines.name=symbol?'Arena_symbol_outline':'Arena_wall_outline';lines.renderOrder=1;
  mesh.add(lines);records.push({mesh,old,materials,lines});
 }
 return {refreshEdges(){for(const {mesh,lines} of records){lines.geometry.dispose();lines.geometry=arenaEdges(mesh.geometry,c.edgeThresholdDegrees);}},edgeSegments:records.reduce((n,r)=>n+r.lines.geometry.attributes.position.count/2,0),dispose(){
  for(const {mesh,old,materials,lines} of records){mesh.material=old;materials.forEach(m=>m.dispose());lines.removeFromParent();lines.geometry.dispose();lines.material.dispose();}records.length=0;
 }};
}
