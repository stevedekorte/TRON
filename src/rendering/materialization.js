import * as T from 'three';
import {MATERIALIZATION,materializationPhase} from '../game/materialization.js';
import {TELEPORTERS} from '../levels/teleporters.js';

// Clip against the original caster position, also for projected ground shadows.
function portalClip(material,uniforms,wire=false){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous?.(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 portalWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace(/void main\s*\(\s*\)\s*\{/,m=>m+'portalWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader='varying vec3 portalWorld;uniform float portalActive;uniform vec3 portalMin;uniform vec3 portalMax;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/,m=>m+`if(portalActive>.5){bool inside=all(greaterThanEqual(portalWorld,portalMin))&&all(lessThanEqual(portalWorld,portalMax));if(${wire?'!inside':'inside'})discard;}`);
 };
 material.customProgramCacheKey=()=>key+'|portal-volume-v1:'+wire;material.needsUpdate=true;
}

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
 constructor(root,{axis='z',reverse=false,wireFog=true,isLiveMaterial=()=>false}={}){
  this.frame=new T.Matrix4().makeRotationY(axis==='x'?(reverse?Math.PI/2:-Math.PI/2):(reverse?Math.PI:0));
  this.frameInverse=this.frame.clone().invert();
  this.root=root;this.inverse={value:new T.Matrix4()};
  this.portal={portalActive:{value:0},portalMin:{value:new T.Vector3()},portalMax:{value:new T.Vector3()}};
  this.solid={rezInverse:this.inverse,rezCut:{value:1e6},rezAlpha:{value:1}};
  this.live={rezInverse:this.inverse,rezCut:{value:1e6}};
  this.materials=[];this.opacity=1;
  this.wire={rezInverse:this.inverse,rezCut:{value:-1e6}};
  root.updateMatrixWorld(true);
  const inverse=this.frame.clone().multiply(root.matrixWorld.clone().invert()),bounds=new T.Box3(),sources=[];
  root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)sources.push(o);});
  for(const mesh of sources){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));}
  this.bounds=bounds;this.wires=[];this.depthMaterials=[];
  const patched=new Set();
  root.traverse(o=>{
   if(!o.isMesh&&!o.isLine)return;
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(!patched.has(m)){const live=isLiveMaterial(m);this.materials.push({material:m,transparent:m.transparent,depthWrite:m.depthWrite,blending:m.blending,live});reveal(m,live?this.live:this.solid);portalClip(m,this.portal);patched.add(m);}
  });
  const lineMaterial=new T.LineBasicMaterial({color:new T.Color(4,.015,.005),toneMapped:false,transparent:true,opacity:1,depthWrite:false,fog:wireFog});reveal(lineMaterial,this.wire);this.lineMaterial=lineMaterial;
  portalClip(lineMaterial,this.portal,true);
  for(const mesh of sources){
   if(sources.some(o=>o.material.name==='Base')&&mesh.material.name!=='Base')continue;
   const lines=new T.LineSegments(new T.EdgesGeometry(mesh.geometry,25),lineMaterial);lines.userData.breakupExclude=true;lines.visible=false;mesh.add(lines);this.wires.push(lines);
   const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide,blending:T.NoBlending});reveal(depth,{rezInverse:this.inverse,rezCut:this.solid.rezCut});portalClip(depth,this.portal);mesh.userData.rezDepthMaterial=depth;this.depthMaterials.push(depth);
  }
  const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
   uniforms:{strength:{value:0},lineStrength:{value:0}},vertexShader:'varying vec2 uvRez;void main(){uvRez=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'varying vec2 uvRez;uniform float strength;uniform float lineStrength;void main(){vec2 edge=min(uvRez,1.-uvRez);float border=1.-smoothstep(.003,.009,min(edge.x,edge.y));gl_FragColor=vec4(vec3(3.,.025,.005),strength*(.025+max(border,lineStrength)*.8));}'});
  this.rectangle=new T.Mesh(new T.PlaneGeometry(size.x+4,size.y+4),material);this.rectangle.position.set(center.x,center.y,0).applyMatrix4(this.frameInverse);this.rectangle.quaternion.setFromRotationMatrix(this.frameInverse);this.rectangleCenter=center;this.rectangle.userData.breakupExclude=true;this.rectangle.visible=false;root.add(this.rectangle);
 }
 update(age=null,pad=null,sweep=null){
  if(age!==null)pad=null;
  this.portal.portalActive.value=pad?1:0;
  if(pad){const h=pad.size/2;this.portal.portalMin.value.set(pad.x-h,0,-pad.s-h);this.portal.portalMax.value.set(pad.x+h,pad.height??TELEPORTERS.height,-pad.s+h);}
  this.root.updateWorldMatrix(true,false);this.inverse.value.copy(this.root.matrixWorld).invert().premultiply(this.frame);
  const phase=sweep?.phase??(age===null?{complete:true}:materializationPhase(age)),active=!phase.complete;
  const scale=new T.Vector3().setFromMatrixScale(this.root.matrixWorld);
  const padding=MATERIALIZATION.sweepClearance/scale.z,from=this.bounds.min.z-padding,to=this.bounds.max.z+padding;
  this.opacity=active?phase.solid:1;
  this.solid.rezAlpha.value=this.opacity;
  // Solids fade across the whole vehicle after the only spatial sweep.
  this.solid.rezCut.value=this.opacity>0?1e6:from;
  for(const original of this.materials){
   const fading=this.opacity<1&&!original.live;
   const m=original.material,transparent=fading||original.transparent;
   if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
   m.depthWrite=fading?false:original.depthWrite;
   m.blending=fading?T.NormalBlending:original.blending;
  }
  this.lineMaterial.opacity=pad?1:1-this.opacity;
  this.wire.rezCut.value=pad?1e6:active?(sweep?.cut??T.MathUtils.lerp(from,to,phase.wire)):-1e6;
  this.live.rezCut.value=active?this.wire.rezCut.value:1e6;
  for(const wire of this.wires)wire.visible=active||!!pad;
  this.rectangle.visible=active;this.rectangle.material.uniforms.strength.value=active?phase.opacity:0;
  this.rectangle.material.uniforms.lineStrength.value=active?Math.max(0,1-phase.height/.06):0;
  if(active){
   this.rectangle.position.set(this.rectangleCenter.x,this.rectangleCenter.y,sweep?.cut??T.MathUtils.lerp(from,to,phase.scan)).applyMatrix4(this.frameInverse);
   const lineScale=MATERIALIZATION.lineHeight/(this.rectangle.geometry.parameters.height*scale.y);
   this.rectangle.scale.y=T.MathUtils.lerp(lineScale,1,phase.height);
  }
 }
 dispose(){for(const depth of this.depthMaterials)depth.dispose();}
}
