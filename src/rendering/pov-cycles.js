// Loaded only on explicit selection. Proxy boxes bound ray work; the actual CSG
// hit writes depth into the ordinary scene, before bloom/AA/output conversion.
import * as T from 'three';
import {cycleMaterializationPhase} from '../game/cycle-materialization.js';
import {cycleSceneGLSL,CYCLE_EDGE_CONFIG} from '../experiments/cycle-ray-shader.js';
import {POV_CYCLE_SCALE} from '../experiments/pov-cycle-model.js';
const EDGE_FILTER={radiusPixels:1.2,creaseStart:.18,creaseFull:.65,strength:.8,paintStrength:.22};
export const CYCLE_REZ={sectionSpacingMeters:[.22,.24,.32],lineHalfWidthMeters:.006,lineIntensity:2.2,contourColor:0xd0dc9a,gridColor:0x75b5b7,haloColor:0x39bccc,bodyGlowIntensity:5,frontMeters:-1.8,rearMeters:1.8};
const COLORS=[0xe6bd14,0x086ac4,0xff1010,0x178c42];
const vertexShader=`varying vec3 localSurface;void main(){localSurface=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader=cycleSceneGLSL+`
uniform mat4 inverseCycleWorld,cycleWorld,viewProjection;
uniform vec3 sceneFogColor;uniform float sceneFogDensity;
uniform bool edgeNormalPass,edgeMapReady;
uniform sampler2D edgeMap;
uniform vec2 edgeResolution;
uniform float rezSolid,rezSweep,rezGrid,rezGlow;
float edgeCoverageAt(vec3 normal,float radius){
 vec2 uv=gl_FragCoord.xy/edgeResolution;
 float coverage=0.;
 for(int i=0;i<8;i++){
  float angle=float(i)*.7853981634;
  vec4 neighbor=texture2D(edgeMap,uv+vec2(cos(angle),sin(angle))*radius/edgeResolution);
  vec3 neighborNormal=normalize(neighbor.rgb/max(neighbor.a,.001)*2.-1.);
  float edge=smoothstep(${EDGE_FILTER.creaseStart},${EDGE_FILTER.creaseFull},length(normal-neighborNormal));
  coverage+=max(edge,1.-neighbor.a)*.125;
 }
 return coverage;
}
float filteredEdgeCoverage(vec3 normal){return edgeCoverageAt(normal,${EDGE_FILTER.radiusPixels});}
vec3 filteredEdges(vec3 color,vec3 normal,int material){
 float coverage=filteredEdgeCoverage(normal);
 vec3 ink=vec3(${new T.Color(CYCLE_EDGE_CONFIG.color).toArray().join(',')});
 return mix(color,max(color,ink),coverage*${EDGE_FILTER.strength}*(material==1?${EDGE_FILTER.paintStrength}:1.));
}
varying vec3 localSurface;
void main(){
 vec3 origin=(inverseCycleWorld*vec4(cameraPosition,1)).xyz;
 vec3 direction=normalize(localSurface-origin);
 Hit h=cycleHit(origin,direction);if(h.material==0)discard;
 vec3 localPoint=origin+direction*h.t,worldPoint=(cycleWorld*vec4(localPoint,1)).xyz;
 vec3 normal=normalize(mat3(cycleWorld)*h.n);
 vec4 clip=viewProjection*vec4(worldPoint,1);gl_FragDepth=clip.z/clip.w*.5+.5;
 if(edgeNormalPass){gl_FragColor=vec4(normal*.5+.5,1.);return;}
 // Construction curves are intersections of the exact CSG surface with
 // evenly spaced local section planes, analytically filtered in pixel space.
 vec3 spacing=vec3(${CYCLE_REZ.sectionSpacingMeters.join(',')});
 vec3 distanceToSection=abs(fract(localPoint/spacing+.5)-.5)*spacing;
 vec3 footprint=max(fwidth(localPoint),vec3(.00001));
 vec3 lines=(1.-smoothstep(vec3(${CYCLE_REZ.lineHalfWidthMeters}),vec3(${CYCLE_REZ.lineHalfWidthMeters})+footprint,distanceToSection))*min(vec3(1.),vec3(${2*CYCLE_REZ.lineHalfWidthMeters})/footprint);
 float grid=max(lines.x,max(lines.y,lines.z))*rezGrid;
 float contour=edgeMapReady?min(1.,filteredEdgeCoverage(normal)*2.):0.;
 float halo=edgeMapReady?edgeCoverageAt(normal,3.)*.22:0.;
 float cut=mix(${CYCLE_REZ.frontMeters},${CYCLE_REZ.rearMeters},rezSweep);
 float revealed=1.-smoothstep(cut-max(fwidth(localPoint.z),.001),cut,localPoint.z);
 contour*=revealed;halo*=revealed;grid*=revealed;
 float wire=max(max(contour,grid),halo);
 float alpha=rezSolid+(1.-rezSolid)*wire;
 if(alpha<.002)discard;
 // Transform the world light into this cycle's coordinates for self-occlusion.
 vec3 key=normalize(vec3(-1,2,-1));
 float visibility=1.;
 if(rezSolid>0.&&dot(normal,key)>0.){
  vec3 localKey=normalize(mat3(inverseCycleWorld)*key);
  if(cycleHit(localPoint+h.n*.002,localKey).material!=0)visibility=.15;
 }
 vec3 color=lightingVisible(worldPoint,normal,normalize(cameraPosition-worldPoint),materialColor(h.material),h.material==2?90.:45.,visibility);
 color=edgeMapReady?filteredEdges(color,normal,h.material):cycleEdgeHighlights(color,normal,normalize(cameraPosition-worldPoint),h.material);
 vec3 contourColor=vec3(${new T.Color(CYCLE_REZ.contourColor).toArray().join(',')});
 vec3 gridColor=vec3(${new T.Color(CYCLE_REZ.gridColor).toArray().join(',')});
 vec3 haloColor=vec3(${new T.Color(CYCLE_REZ.haloColor).toArray().join(',')});
 vec3 wireColor=(contourColor*contour+gridColor*grid+haloColor*halo)/max(contour+grid+halo,.001)*${CYCLE_REZ.lineIntensity};
 // The solid briefly blooms almost white, while glass stays dark.
 color+=mix(bodyColor,vec3(.88,1.,.8),.8)*rezGlow*${CYCLE_REZ.bodyGlowIntensity.toFixed(1)}*(h.material==2?.04:1.);
 color=mix(wireColor,color,rezSolid/max(alpha,.001));
 float depth=-(viewMatrix*vec4(worldPoint,1)).z;
 color=mix(color,sceneFogColor,1.-exp(-sceneFogDensity*sceneFogDensity*depth*depth));
 gl_FragColor=vec4(color,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createPovCycleGeometry(){
 const scale=POV_CYCLE_SCALE;
 return new T.BoxGeometry(160*scale,230.1*scale,525.2*scale).translate(0,115*scale,0);
}
export function createPovCycleMesh(color=COLORS[0],geometry=createPovCycleGeometry()){
   const uniforms={rezGrid:{value:1},rezGlow:{value:0},rezSolid:{value:1},rezSweep:{value:1},edgeNormalPass:{value:false},edgeMapReady:{value:false},edgeMap:{value:null},edgeResolution:{value:new T.Vector2()},bodyColor:{value:new T.Color(color)},inverseCycleWorld:{value:new T.Matrix4()},cycleWorld:{value:new T.Matrix4()},viewProjection:{value:new T.Matrix4()},sceneFogColor:{value:new T.Color()},sceneFogDensity:{value:0}};
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
  this.raceView=raceView;this.saved=[];this.edges=new PovCycleEdges();
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
   // Keep one analytic model throughout the wire sweep and solid fade.
   proxy.visible=this.raceView.root.visible&&source.visible;
   if(!proxy.visible)continue;
   const uniforms=proxy.material.uniforms;
   const phase=cycleMaterializationPhase(source.userData.cycleFormationProgress??1);
   uniforms.rezSolid.value=phase.solid;
   uniforms.rezSweep.value=phase.contours;
   uniforms.rezGrid.value=phase.grid;
   uniforms.rezGlow.value=phase.glow;
   const transparent=phase.solid<1;
   if(proxy.material.transparent!==transparent){proxy.material.transparent=transparent;proxy.material.needsUpdate=true;}
   proxy.material.depthWrite=!transparent;
   proxy.position.copy(source.position);proxy.position.y-=source.userData.groundOffsetMeters??0;
   proxy.quaternion.copy(source.quaternion);proxy.material.uniforms.bodyColor.value.setHex(COLORS[source.userData.team]??COLORS[0]);
   this.saved.push(source);source.visible=false;
  }
 }
 restore(){for(const source of this.saved)source.visible=true;this.saved.length=0;}
 dispose(){this.edges.dispose();this.restore();this.root.removeFromParent();for(const proxy of this.proxies)proxy.material.dispose();this.geometry.dispose();}
}

// A filtered normal buffer fills pixel-quad gaps without repeated CSG edge rays.
export class PovCycleEdges {
 constructor(){this.target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter});this.size=new T.Vector2();}
 render(renderer,root,camera){
  const meshes=[];root.traverse(o=>{if(o.visible&&o.material?.uniforms?.edgeNormalPass)meshes.push(o);});
  if(!meshes.length)return;
  renderer.getDrawingBufferSize(this.size);this.target.setSize(this.size.x,this.size.y);
  const previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
  const depthWrites=meshes.map(mesh=>mesh.material.depthWrite);
  for(const mesh of meshes){mesh.material.depthWrite=true;const u=mesh.material.uniforms;u.edgeNormalPass.value=true;u.edgeMapReady.value=false;u.edgeMap.value=null;}
  try{renderer.setRenderTarget(this.target);renderer.setClearColor(0,0);renderer.autoClear=true;renderer.render(root,camera);}
  finally{
   renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);renderer.autoClear=autoClear;
   for(const [i,mesh] of meshes.entries()){mesh.material.depthWrite=depthWrites[i];const u=mesh.material.uniforms;u.edgeNormalPass.value=false;u.edgeMapReady.value=true;u.edgeMap.value=this.target.texture;u.edgeResolution.value.copy(this.size);}
  }
 }
 dispose(){this.target.dispose();}
}
