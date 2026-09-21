import * as T from 'three';
import {MATERIALIZATION,materializationPhase} from '../game/materialization.js';

// Reveal existing geometry without changing its topology or material shading.
function reveal(material,uniforms){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous?.(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='uniform mat4 rezInverse;varying float rezZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace(/void main\s*\(\s*\)\s*\{/,m=>m+'rezZ=(rezInverse*modelMatrix*vec4(position,1.)).z;');
  shader.fragmentShader='uniform float rezCut;varying float rezZ;\n'+shader.fragmentShader;
  if(uniforms.rezAlpha){
   shader.fragmentShader='uniform float rezAlpha;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/, 'gl_FragColor.a*=rezAlpha;}');
  }
  shader.fragmentShader=shader.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/,m=>m+'if(rezZ>rezCut)discard;');
 };
 material.customProgramCacheKey=()=>key+'|rez-sweep-v2:'+!!uniforms.rezAlpha;material.needsUpdate=true;
}
export class Materialization{
 constructor(root){
  this.root=root;this.inverse={value:new T.Matrix4()};
  this.solid={rezInverse:this.inverse,rezCut:{value:1e6},rezAlpha:{value:1}};
  this.materials=[];this.opacity=1;
  this.wire={rezInverse:this.inverse,rezCut:{value:-1e6}};
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),bounds=new T.Box3(),sources=[];
  root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)sources.push(o);});
  for(const mesh of sources){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));}
  this.bounds=bounds;this.wires=[];this.depthMaterials=[];
  const patched=new Set();
  root.traverse(o=>{
   if(!o.isMesh)return;
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(!patched.has(m)){this.materials.push({material:m,transparent:m.transparent,depthWrite:m.depthWrite,blending:m.blending});reveal(m,this.solid);patched.add(m);}
  });
  const lineMaterial=new T.LineBasicMaterial({color:new T.Color(4,.015,.005),toneMapped:false,transparent:true,opacity:1,depthWrite:false});reveal(lineMaterial,this.wire);this.lineMaterial=lineMaterial;
  for(const mesh of sources){
   if(sources.some(o=>o.material.name==='Base')&&mesh.material.name!=='Base')continue;
   const lines=new T.LineSegments(new T.EdgesGeometry(mesh.geometry,25),lineMaterial);lines.userData.breakupExclude=true;lines.visible=false;mesh.add(lines);this.wires.push(lines);
   const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide,blending:T.NoBlending});reveal(depth,{rezInverse:this.inverse,rezCut:this.solid.rezCut});mesh.userData.rezDepthMaterial=depth;this.depthMaterials.push(depth);
  }
  const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
   uniforms:{strength:{value:0},lineStrength:{value:0}},vertexShader:'varying vec2 uvRez;void main(){uvRez=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 uvRez;uniform float strength;uniform float lineStrength;void main(){vec2 edge=min(uvRez,1.-uvRez);float border=1.-smoothstep(.003,.009,min(edge.x,edge.y));gl_FragColor=vec4(vec3(3.,.025,.005),strength*(.025+max(border,lineStrength)*.8));}'});
  this.rectangle=new T.Mesh(new T.PlaneGeometry(size.x+4,size.y+4),material);this.rectangle.position.set(center.x,center.y,0);this.rectangle.userData.breakupExclude=true;this.rectangle.visible=false;root.add(this.rectangle);
 }
 update(age=null){
  this.root.updateWorldMatrix(true,false);this.inverse.value.copy(this.root.matrixWorld).invert();
  const phase=age===null?{complete:true}:materializationPhase(age),active=!phase.complete;
  const scale=new T.Vector3().setFromMatrixScale(this.root.matrixWorld);
  const padding=MATERIALIZATION.sweepClearance/scale.z,from=this.bounds.min.z-padding,to=this.bounds.max.z+padding;
  this.opacity=active?phase.solid:1;
  this.solid.rezAlpha.value=this.opacity;
  // Solids fade across the whole vehicle after the only spatial sweep.
  this.solid.rezCut.value=this.opacity>0?1e6:from;
  const fading=this.opacity<1;
  for(const original of this.materials){
   const m=original.material,transparent=fading||original.transparent;
   if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
   m.depthWrite=fading?false:original.depthWrite;
   m.blending=fading?T.NormalBlending:original.blending;
  }
  this.lineMaterial.opacity=1-this.opacity;
  this.wire.rezCut.value=active?T.MathUtils.lerp(from,to,phase.wire):-1e6;
  for(const wire of this.wires)wire.visible=active;
  this.rectangle.visible=active;this.rectangle.material.uniforms.strength.value=active?phase.opacity:0;
  this.rectangle.material.uniforms.lineStrength.value=active?Math.max(0,1-phase.height/.06):0;
  if(active){
   this.rectangle.position.z=T.MathUtils.lerp(from,to,phase.scan);
   const lineScale=MATERIALIZATION.lineHeight/(this.rectangle.geometry.parameters.height*scale.y);
   this.rectangle.scale.y=T.MathUtils.lerp(lineScale,1,phase.height);
  }
 }
 dispose(){for(const depth of this.depthMaterials)depth.dispose();}
}
