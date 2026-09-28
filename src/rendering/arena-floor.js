import {ARENA_WALL} from '../game/arena-breaches.js';
import { ARENA_GRID } from '../levels/arena-grid.js';
import * as THREE from 'three';
import {GROUND_GRID_AA_SCALE} from '../levels/ground-grid.js';

export const ARENA_FLOOR=Object.freeze({
 innerWallMeters:ARENA_WALL.innerMeters,passageColor:0x062b38,
 sizeMeters:932,elevationMeters:-.06,gridMeters:ARENA_GRID.cellMeters,
 lineHalfWidthMeters:ARENA_GRID.lineHalfWidthMeters,antialiasScale:GROUND_GRID_AA_SCALE,
 fadeStartMeters:160,fadeEndMeters:650,backgroundColor:0x020c1b,lineColor:0x888888,
});
// Finer light-cycle grid; preserve thin-line coverage when viewed from afar.
// Caller owns the returned mesh and disposes its geometry/material.
export function createArenaFloor(options={}){
 const c={...ARENA_FLOOR,...options};
 const material=new THREE.ShaderMaterial({
  uniforms:{innerWall:{value:c.innerWallMeters},passageColor:{value:new THREE.Color(c.passageColor)},gridMeters:{value:c.gridMeters},halfWidth:{value:c.lineHalfWidthMeters},aaScale:{value:c.antialiasScale},fadeRange:{value:new THREE.Vector2(c.fadeStartMeters,c.fadeEndMeters)},background:{value:new THREE.Color(c.backgroundColor)},lineColor:{value:new THREE.Color(c.lineColor)}},
  vertexShader:`varying vec3 worldPosition; varying vec2 gridPosition;
   void main(){
#include <begin_vertex>
vec4 p=modelMatrix*vec4(position,1.);worldPosition=p.xyz;gridPosition=position.xy;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader:`varying vec3 worldPosition; varying vec2 gridPosition;
   uniform float gridMeters,halfWidth,aaScale,innerWall;
   uniform vec2 fadeRange;
   uniform vec3 background,lineColor,passageColor;
   void main(){
    vec2 cell=abs(fract(gridPosition/gridMeters+.5)-.5)*gridMeters;
    vec2 aa=max(fwidth(gridPosition)*aaScale,vec2(.00001));
    vec2 lines=(1.-smoothstep(vec2(halfWidth),vec2(halfWidth)+aa,cell))*min(vec2(1.),vec2(2.*halfWidth)/aa);
    float grid=max(lines.x,lines.y);
    float fade=1.-smoothstep(fadeRange.x,fadeRange.y,distance(cameraPosition,worldPosition));
    float interior=1.-step(innerWall,max(abs(gridPosition.x),abs(gridPosition.y)));
    gl_FragColor=vec4(mix(passageColor,mix(background,lineColor,grid*fade),interior),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
  toneMapped:false,
 });
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(c.sizeMeters,c.sizeMeters),material);
 mesh.name='Procedural_arena_floor';mesh.rotation.x=-Math.PI/2;mesh.position.y=c.elevationMeters;
 return mesh;
}
