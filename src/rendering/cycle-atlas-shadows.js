import * as T from 'three';

// Shared four-tap reception at the analytic surface hit, independent of proxy bounds.
export function createCycleAtlasShadowBinding({prefix,maxCasters,darkness,depthBias=.0002,includePacking=true}){
 const glsl=`
${includePacking?'#include <packing>':''}
uniform sampler2D aircraftShadowAtlas;
uniform mat4 aircraftShadowMatrices[${maxCasters}];
uniform float aircraftShadowStrength[${maxCasters}];
uniform vec3 aircraftShadowLayout;
uniform int aircraftShadowCount;
float aircraftVisibility(vec3 worldPoint){
 float shade=1.;
 for(int i=0;i<${maxCasters};i++){
  if(i>=aircraftShadowCount)break;
  vec4 projected=aircraftShadowMatrices[i]*vec4(worldPoint,1.);
  vec3 p=projected.xyz/projected.w;
  vec3 px=dFdx(p),py=dFdy(p);
  float det=px.x*py.y-px.y*py.x;
  vec2 slope=abs(det)>1e-20?vec2(px.z*py.y-py.z*px.y,py.z*px.x-px.z*py.x)/det:vec2(0.);
  if(all(greaterThan(p,vec3(0.)))&&all(lessThan(p,vec3(1.)))){
   float size=aircraftShadowLayout.z;
   vec2 texel=p.xy*size-.5,base=floor(texel),fraction=fract(texel);
   vec2 tile=vec2(mod(float(i),aircraftShadowLayout.x),floor(float(i)/aircraftShadowLayout.x));
   float cover=0.;
   for(int tap=0;tap<4;tap++){
    vec2 offset=vec2(float(tap%2),float(tap/2));
    vec2 local=(clamp(base+offset,vec2(0.),vec2(size-1.))+.5)/size;
    float depth=p.z+dot(slope,local-p.xy);
    float bias=${depthBias}+.75*(abs(slope.x)+abs(slope.y))/size;
    float blocked=step(unpackRGBAToDepth(texture2D(aircraftShadowAtlas,(local+tile)/aircraftShadowLayout.xy))+bias,depth);
    vec2 weight=mix(1.-fraction,fraction,offset);
    cover+=blocked*weight.x*weight.y;
   }
   shade=min(shade,1.-${darkness}*cover*aircraftShadowStrength[i]);
  }
 }
 return shade;
}`;
 function createUniforms(){
 const uniforms={aircraftShadowAtlas:{value:null},aircraftShadowCount:{value:0},aircraftShadowLayout:{value:new T.Vector3(1,1,512)},aircraftShadowMatrices:{value:Array.from({length:maxCasters},()=>new T.Matrix4())},aircraftShadowStrength:{value:new Float32Array(maxCasters)}};
 return Object.fromEntries(Object.entries(uniforms).map(([key,value])=>[key.replaceAll('aircraft',prefix),value]));
}
 function update(targetUniforms,atlas){
 const count=Math.min(atlas?.entries.length??0,maxCasters);
 targetUniforms[prefix+'ShadowCount'].value=count;
 if(!count)return;
 targetUniforms[prefix+'ShadowAtlas'].value=atlas.target.texture;
 targetUniforms[prefix+'ShadowLayout'].value.set(atlas.columns,atlas.rows,atlas.size);
 for(let i=0;i<count;i++){
  targetUniforms[prefix+'ShadowMatrices'].value[i].copy(atlas.entries[i].matrix);
  targetUniforms[prefix+'ShadowStrength'].value[i]=atlas.strengths[i];
 }
}
 return {glsl:glsl.replaceAll('aircraft',prefix),createUniforms,update};
}
