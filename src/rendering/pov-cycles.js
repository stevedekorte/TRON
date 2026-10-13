// Loaded only on explicit selection. Proxy boxes bound ray work; the actual CSG
// hit writes depth into the ordinary scene, before bloom/AA/output conversion.
import * as T from 'three';
import {cycleSceneGLSL} from '../experiments/cycle-ray-shader.js';
import {POV_CYCLE_SCALE} from '../experiments/pov-cycle-model.js';
const COLORS=[0xe6bd14,0x086ac4,0xff1010,0x178c42];
const vertexShader=`varying vec3 localSurface;void main(){localSurface=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader=cycleSceneGLSL+`
uniform mat4 inverseCycleWorld,cycleWorld,viewProjection;
uniform vec3 sceneFogColor;uniform float sceneFogDensity;
varying vec3 localSurface;
void main(){
 vec3 origin=(inverseCycleWorld*vec4(cameraPosition,1)).xyz;
 vec3 direction=normalize(localSurface-origin);
 Hit h=cycleHit(origin,direction);if(h.material==0)discard;
 vec3 localPoint=origin+direction*h.t,worldPoint=(cycleWorld*vec4(localPoint,1)).xyz;
 vec3 normal=normalize(mat3(cycleWorld)*h.n);
 // Transform the world light into this cycle's coordinates for self-occlusion.
 vec3 key=normalize(vec3(-1,2,-1));
 float visibility=1.;
 if(dot(normal,key)>0.){
  vec3 localKey=normalize(mat3(inverseCycleWorld)*key);
  if(cycleHit(localPoint+h.n*.002,localKey).material!=0)visibility=.15;
 }
 vec3 color=lightingVisible(worldPoint,normal,normalize(cameraPosition-worldPoint),materialColor(h.material),h.material==2?90.:45.,visibility);
 float depth=-(viewMatrix*vec4(worldPoint,1)).z;
 color=mix(color,sceneFogColor,1.-exp(-sceneFogDensity*sceneFogDensity*depth*depth));
 vec4 clip=viewProjection*vec4(worldPoint,1);gl_FragDepth=clip.z/clip.w*.5+.5;
 gl_FragColor=vec4(color,1);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createPovCycleGeometry(){
 const scale=POV_CYCLE_SCALE;
 return new T.BoxGeometry(160*scale,230.1*scale,525.2*scale).translate(0,115*scale,0);
}
export function createPovCycleMesh(color=COLORS[0],geometry=createPovCycleGeometry()){
   const uniforms={bodyColor:{value:new T.Color(color)},inverseCycleWorld:{value:new T.Matrix4()},cycleWorld:{value:new T.Matrix4()},viewProjection:{value:new T.Matrix4()},sceneFogColor:{value:new T.Color()},sceneFogDensity:{value:0}};
   const material=new T.ShaderMaterial({defines:{SHOW_CYCLE:1},uniforms,vertexShader,fragmentShader,side:T.BackSide});
   const mesh=new T.Mesh(geometry,material);mesh.name='CSG cycle';mesh.visible=false;
   mesh.onBeforeRender=(renderer,scene,camera)=>{
    uniforms.cycleWorld.value.copy(mesh.matrixWorld);uniforms.inverseCycleWorld.value.copy(mesh.matrixWorld).invert();
    uniforms.viewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    uniforms.sceneFogColor.value.copy(scene.fog?.color??scene.background??new T.Color(0));uniforms.sceneFogDensity.value=scene.fog?.density??0;
   };
 return mesh;
}
export class PovCycles {
 constructor(raceView){
  this.raceView=raceView;this.saved=[];
  this.geometry=createPovCycleGeometry();
  this.root=new T.Group();this.root.name='POV-Ray cycle renderer';raceView.root.add(this.root);
  this.proxies=raceView.bikes.map((_,id)=>{
   const mesh=createPovCycleMesh(COLORS[0],this.geometry);mesh.name=`CSG cycle ${id}`;
   this.root.add(mesh);return mesh;
  });
 }
 async warm(renderer,camera){
  const scene=new T.Scene(),mesh=new T.Mesh(this.geometry,this.proxies[0].material);scene.add(mesh);
  await renderer.compileAsync(scene,camera);
 }
 prepare(){
  this.restore();
  for(let i=0;i<this.proxies.length;i++){
   const source=this.raceView.bikes[i],proxy=this.proxies[i],rez=this.raceView.materializations[i];
   // Keep the existing wire-to-solid opening until its materialization finishes.
   proxy.visible=this.raceView.root.visible&&source.visible&&rez.opacity>=.999;
   if(!proxy.visible)continue;
   proxy.position.copy(source.position);proxy.position.y-=source.userData.groundOffsetMeters??0;
   proxy.quaternion.copy(source.quaternion);proxy.material.uniforms.bodyColor.value.setHex(COLORS[source.userData.team]??COLORS[0]);
   this.saved.push(source);source.visible=false;
  }
 }
 restore(){for(const source of this.saved)source.visible=true;this.saved.length=0;}
 dispose(){this.restore();this.root.removeFromParent();for(const proxy of this.proxies)proxy.material.dispose();this.geometry.dispose();}
}
