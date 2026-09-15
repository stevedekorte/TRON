import {SEARCHLIGHT,scanAngles,projectorOrigin} from '../simulation/spotlight.js';
export {SEARCHLIGHT} from '../simulation/spotlight.js';
import {searchlightStrength} from '../simulation/alertness.js';
import * as THREE from 'three';
import {wallIntersection} from '../levels/maze.js';

const columns=32,rows=8;
// Presentation reads only each observer's goal/memory, never live Clu coordinates.
export function beamPose(e,time){
 const strength=searchlightStrength(e,time);
 if(strength<=0)return null;
 const {yaw,pitch}=e.spotlight||e.scanBeam||scanAngles(e,time),source=projectorOrigin(e);
 const origin=new THREE.Vector3(source.x,source.y,-source.s);
 const direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 const target=e.spotlight?.target;
 const range=target?Math.min(SEARCHLIGHT.range,Math.hypot(target.x-source.x,target.s-source.s,2.8-source.y)+30):SEARCHLIGHT.scanRange;
 return {origin,direction,strength,range};
}
export function clippedBeamEnd(origin,end){
 let t=wallIntersection({x:origin.x,y:origin.y,s:-origin.z},{x:end.x,y:end.y,s:-end.z})??1;
 if(end.y<.04)t=Math.min(t,(origin.y-.04)/(origin.y-end.y));
 return origin.clone().lerp(end,Math.max(0,t));
}
export class Searchlights {
 constructor(scene,count){
  this.beams=Array.from({length:count},()=>{
   const geometry=new THREE.BufferGeometry(),positions=new Float32Array((columns+1)*(rows+1)*3),uv=[] ,indices=[];
   for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++)uv.push(x/columns,y/rows);
   for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);
   }
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{strength:{value:0}},vertexShader:'varying vec2 beamUv;void main(){beamUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 beamUv;uniform float strength;
    void main(){float x=abs(beamUv.x*2.-1.);float core=exp(-x*x*24.);float halo=exp(-x*x*5.)*(1.-smoothstep(.8,1.,x));
    float ends=smoothstep(0.,.035,beamUv.y)*(1.-smoothstep(.94,1.,beamUv.y));
    vec3 color=mix(vec3(.12,.15,1.),vec3(.78,.95,1.),core);
    gl_FragColor=vec4(color*(.7+core*1.5),(halo*.22+core*.42)*ends*strength);}`});
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=2;scene.add(mesh);
   return {mesh,strength:0};
  });
 }
 reset(){for(const beam of this.beams){beam.strength=0;beam.mesh.visible=false;}}
 update(enemies,time,camera,dt,visible){
  this.beams.forEach((beam,i)=>{
   const pose=visible&&enemies[i]?beamPose(enemies[i],time):null;
   if(enemies[i]?.targetGone)beam.strength=0;
   beam.strength=THREE.MathUtils.lerp(beam.strength,pose?.strength||0,1-Math.exp(-dt*5));
   if(pose)beam.pose=pose;
   beam.mesh.visible=visible&&beam.strength>.005&&!!beam.pose&&enemies[i]?.state!=='destroyed';
   if(!beam.mesh.visible)return;
   const {origin,direction,range}=beam.pose;
   const side=new THREE.Vector3().crossVectors(direction,camera.position.clone().sub(origin)).normalize();
   if(side.lengthSq()<.01)side.set(1,0,0);
   const position=beam.mesh.geometry.attributes.position;
   let shortest=range;
   for(let x=0;x<=columns;x++){
    const lateral=x/columns*2-1;
    const start=origin.clone().addScaledVector(side,lateral*1.0);
    const end=clippedBeamEnd(start,origin.clone().addScaledVector(direction,range).addScaledVector(side,lateral*SEARCHLIGHT.halfWidth));
    shortest=Math.min(shortest,start.distanceTo(end));
    for(let y=0;y<=rows;y++){
     const p=start.clone().lerp(end,y/rows);position.setXYZ(y*(columns+1)+x,p.x,p.y,p.z);
    }
   }
   beam.length=shortest;position.needsUpdate=true;beam.mesh.material.uniforms.strength.value=beam.strength;
  });
 }
}
