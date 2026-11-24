import * as THREE from 'three';

export const HUMAN_STRIPE = Object.freeze({halfWidthMeters:.22, slope:.5, centerHeightMeters:.95, bodyLimitMeters:.61,
 // Pattern 2: two thinner parallel slashes, centred this far either side of the single slash's centre line.
 doubleHalfWidthMeters:.09, doubleOffsetMeters:.17,
 // Pattern 3: a chevron, the same from either side of the cycle (a mirrored slash would not be).
 chevronSlope:1.1, chevronHalfWidthMeters:.15, chevronOffsetMeters:-.12});
/** Identifying patterns for human riders, unique within a team (the server assigns 1–3). */
export const HUMAN_STRIPE_PATTERNS = Object.freeze(['single slash','double slash','chevron']);
const f=value=>Number(value).toFixed(4);
// humanStripe: 0 none, 1 single slash, 2 double slash, 3 chevron. Each band is half black, half white.
export const humanStripeGLSL = `
uniform float humanStripe;
vec3 humanPaint(vec3 paint,vec3 p){
 float y=p.y-${f(HUMAN_STRIPE.centerHeightMeters)};
 float slash=p.z-${f(HUMAN_STRIPE.slope)}*y;
 float chevron=p.z-${f(HUMAN_STRIPE.chevronSlope)}*abs(y)-(${f(HUMAN_STRIPE.chevronOffsetMeters)});
 float aa=max(fwidth(slash),.001),aaChevron=max(fwidth(chevron),.001);
 float d=slash,halfWidth=${f(HUMAN_STRIPE.halfWidthMeters)},edge=aa;
 if(humanStripe>2.5){d=chevron;halfWidth=${f(HUMAN_STRIPE.chevronHalfWidthMeters)};edge=aaChevron;}
 else if(humanStripe>1.5){
  float a=slash-${f(HUMAN_STRIPE.doubleOffsetMeters)},b=slash+${f(HUMAN_STRIPE.doubleOffsetMeters)};
  d=abs(a)<abs(b)?a:b;halfWidth=${f(HUMAN_STRIPE.doubleHalfWidthMeters)};
 }
 float mask=(1.-smoothstep(halfWidth-edge,halfWidth+edge,abs(d)))
  *(1.-smoothstep(${f(HUMAN_STRIPE.bodyLimitMeters-.01)},${f(HUMAN_STRIPE.bodyLimitMeters)},abs(p.z)))*step(.5,humanStripe);
 vec3 stripe=mix(vec3(.008),vec3(.9),smoothstep(-edge,edge,d));
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
  material.customProgramCacheKey=()=>previousKey+'-human-stripe-v2';
 }
}

// Carry the same paint coordinates onto the construction lines, so a human's
// identifying slash is present before the solid body has faded in.
export function installHumanWireStripe(root,rez){
 root.updateMatrixWorld(true);
 const toMeters=new THREE.Matrix4().makeScale(root.scale.x,root.scale.y,root.scale.z).multiply(root.matrixWorld.clone().invert());
 for(const line of rez.wires){
  const painted=[].concat(line.parent.material).some(m=>['Color_D06','_1','Color_L12'].includes(m.name));
  const positions=line.geometry.attributes.position,local=new Float32Array(positions.count*3);
  const transform=toMeters.clone().multiply(line.parent.matrixWorld),point=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(transform);
   if(!painted)point.z=1e6;
   point.toArray(local,i*3);
  }
  line.geometry.setAttribute('cycleStripePosition',new THREE.BufferAttribute(local,3));
 }
 const material=rez.lineMaterial,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);shader.uniforms.humanStripe=root.userData.humanStripe;
  shader.vertexShader='attribute vec3 cycleStripePosition; varying vec3 stripePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstripePosition=cycleStripePosition;');
  shader.fragmentShader='varying vec3 stripePosition;\n'+humanStripeGLSL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=humanPaint(diffuseColor.rgb,stripePosition);');
 };
 material.customProgramCacheKey=()=>key+'-human-wire-stripe-v2';material.needsUpdate=true;
}
