import {DEFAULT_WORLD,worldFor} from '../levels/scenario.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import cloudUrl from '../../docs/models/cloud.glb?url';
import {CARRIER} from '../game/carrier.js';
import {seededRandom} from '../game/random.js';

// The extracted grid is rotated 44.22937 degrees in XZ; this yaw aligns its
// long axis and grid lines with world +X, the shared direction of travel.
export const CLOUDS=Object.freeze({count:3,altitude:CARRIER.altitude*3,speed:6,lanePadding:700,yaw:44.22937*Math.PI/180,edgeFade:900,fadeNear:4000,fadeFar:6500});
export function cloudBounds(world=DEFAULT_WORLD){
const {MAZE_LENGTH,MAZE_INSTANCES,SPAWN}=world,margin=MAZE_LENGTH*2;
return Object.freeze({
 minX:Math.min(SPAWN.x,...MAZE_INSTANCES.map(m=>m.x))-margin,
 maxX:Math.max(SPAWN.x,...MAZE_INSTANCES.map(m=>m.x))+margin,
 minZ:Math.min(-SPAWN.s,...MAZE_INSTANCES.map(m=>-m.s))-margin,
 maxZ:Math.max(-SPAWN.s,...MAZE_INSTANCES.map(m=>-m.s))+margin
});
}
export const CLOUD_BOUNDS=cloudBounds();
// Stateless cycles keep pauses, resets, and repeatable runs stable. Each new
// crossing varies its position inside a dedicated lane and its size while hidden.
// The lane padding exceeds the maximum cloud half-extent, so even clouds
// passing at identical X coordinates cannot overlap before or after wrapping.
export function cloudPose(index,time,seed,b=CLOUD_BOUNDS){
 const width=b.maxX-b.minX;
 const initial=seededRandom((seed^Math.imul(index+1,2654435761))>>>0);
 const travel=initial()*width+time*CLOUDS.speed,cycle=Math.floor(travel/width);
 const random=seededRandom((seed^Math.imul(index+1,2246822519)^Math.imul(cycle,3266489917))>>>0);
 const laneWidth=(b.maxZ-b.minZ)/CLOUDS.count;
 const z=b.minZ+index*laneWidth+CLOUDS.lanePadding+random()*(laneWidth-2*CLOUDS.lanePadding);
 return {x:b.minX+((travel%width)+width)%width,y:CLOUDS.altitude,z,yaw:CLOUDS.yaw,scale:.8+random()*.5,cycle};
}
export async function loadCloud(){const {scene}=await new GLTFLoader().loadAsync(cloudUrl);let mesh;scene.traverse(o=>{if(o.isMesh)mesh=o;});return mesh;}
export class CloudLayer{
 constructor(source,scene,world=DEFAULT_WORLD){
  this.bounds=cloudBounds(world);
  const material=source.material.clone();material.fog=false;material.transparent=true;material.opacity=.6;material.depthWrite=false;material.forceSinglePass=true;material.emissiveIntensity=.6;
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 cloudWorld; varying vec3 cloudCenter;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncloudWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;cloudCenter=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;');
   // Sky decoration can extend beyond the ground camera's far clip, while
   // retaining depth testing against nearer geometry.
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ngl_Position.z=min(gl_Position.z,gl_Position.w*.99999);');
   shader.fragmentShader='varying vec3 cloudWorld; varying vec3 cloudCenter;\n'+shader.fragmentShader;
   const b=this.bounds;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float edge=min(min(cloudCenter.x-(${b.minX.toFixed(3)}),${b.maxX.toFixed(3)}-cloudCenter.x),min(cloudCenter.z-(${b.minZ.toFixed(3)}),${b.maxZ.toFixed(3)}-cloudCenter.z));
    diffuseColor.a*=smoothstep(0.,${CLOUDS.edgeFade.toFixed(1)},edge)*(1.-smoothstep(${CLOUDS.fadeNear.toFixed(1)},${CLOUDS.fadeFar.toFixed(1)},distance(cameraPosition.xz,cloudWorld.xz)));`);
  };
  this.mesh=new T.InstancedMesh(source.geometry,material,CLOUDS.count);this.mesh.name='Drifting grid clouds';this.mesh.frustumCulled=false;this.mesh.castShadow=false;this.mesh.receiveShadow=false;
  this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.pose=new T.Object3D();scene.add(this.mesh);
 }
 dispose(){this.mesh.dispose();}
 update(time,seed,visible){
  this.mesh.visible=visible;if(!visible)return;
  if(time===this.time&&seed===this.seed)return;this.time=time;this.seed=seed;
  for(let i=0;i<CLOUDS.count;i++){
   const p=cloudPose(i,time,seed,this.bounds);this.pose.position.set(p.x,p.y,p.z);this.pose.rotation.set(0,p.yaw,0);this.pose.scale.setScalar(p.scale);this.pose.updateMatrix();this.mesh.setMatrixAt(i,this.pose.matrix);
  }
  this.mesh.instanceMatrix.needsUpdate=true;
 }
}
