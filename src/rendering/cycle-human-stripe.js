import * as THREE from 'three';

export const HUMAN_STRIPE = Object.freeze({halfWidthMeters:.22, slope:.5, centerHeightMeters:.95, bodyLimitMeters:.61});
export const humanStripeGLSL = `
uniform float humanStripe;
vec3 humanPaint(vec3 paint,vec3 p){
 float d=p.z-${HUMAN_STRIPE.slope}*(p.y-${HUMAN_STRIPE.centerHeightMeters});
 float aa=max(fwidth(d),.001);
 float mask=(1.-smoothstep(${HUMAN_STRIPE.halfWidthMeters}-aa,${HUMAN_STRIPE.halfWidthMeters}+aa,abs(d)))
  *(1.-smoothstep(${HUMAN_STRIPE.bodyLimitMeters}-.01,${HUMAN_STRIPE.bodyLimitMeters},abs(p.z)))*humanStripe;
 vec3 stripe=mix(vec3(.008),vec3(.9),smoothstep(-aa,aa,d));
 return mix(paint,stripe,mask);
}
`;

// Position is authored once in normalized vehicle meters, independent of the
// camera and vehicle motion. No coplanar decal geometry or additional draw calls.
export function installHumanStripe(root){
 const enabled={value:0};root.userData.humanStripe=enabled;
 root.updateMatrixWorld(true);
 const toMeters=new THREE.Matrix4().makeScale(root.scale.x,root.scale.y,root.scale.z).multiply(root.matrixWorld.clone().invert());
 const materials=new Set();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const painted=[].concat(mesh.material).filter(m=>['Color_D06','_1','Color_L12'].includes(m.name));
  if(!painted.length)return;
  if(!mesh.geometry.attributes.cycleStripePosition){
   const positions=mesh.geometry.attributes.position,local=new Float32Array(positions.count*3);
   const transform=toMeters.clone().multiply(mesh.matrixWorld),point=new THREE.Vector3();
   for(let i=0;i<positions.count;i++)point.fromBufferAttribute(positions,i).applyMatrix4(transform).toArray(local,i*3);
   mesh.geometry.setAttribute('cycleStripePosition',new THREE.BufferAttribute(local,3));
  }
  painted.forEach(m=>materials.add(m));
 });
 for(const material of materials){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material),previousKey=key();
  material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);shader.uniforms.humanStripe=enabled;
   shader.vertexShader='attribute vec3 cycleStripePosition; varying vec3 stripePosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstripePosition=cycleStripePosition;');
   shader.fragmentShader='varying vec3 stripePosition;\n'+humanStripeGLSL+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=humanPaint(diffuseColor.rgb,stripePosition);');
  };
  material.customProgramCacheKey=()=>previousKey+'-human-stripe-v1';
 }
}
