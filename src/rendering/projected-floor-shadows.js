import * as T from 'three';

// Exact silhouettes share one stencil bit: overlapping wall shadows darken
// the floor once. Main-scene MSAA filters the edge without a shadow-map blur.
export const FLOOR_WALL_SHADOWS=Object.freeze({darkness:.88,stencilBit:4,renderOrder:-1.7});
export class ProjectedFloorShadows {
 constructor(root,sources,floors,{tapered=false}={}){
  this.root=root;this.sources=sources;this.floors=floors;this.strengths=new Float32Array([1]);
  this.group=new T.Group();this.group.name='Exact wall floor shadows';root.parent.add(this.group);
  this.inverse=new T.Matrix4();this.arenaCenter=new T.Vector3();this.floorPoint=new T.Vector3();
  this.uniforms={attenuation:{value:1-FLOOR_WALL_SHADOWS.darkness},arenaCenter:{value:this.arenaCenter},arenaHalfSize:{value:new T.Vector2()},floorElevation:{value:new T.Vector2()}};
  const project=`vec4 world=modelMatrix*${tapered?'instanceMatrix*vec4(tapered,1.)':'vec4(position,1.)'};
   world.xz+=vec2(.5)*max(0.,world.y);
   bool arena=all(lessThanEqual(abs(world.xz-arenaCenter.xz),arenaHalfSize));
   world.y=arena?floorElevation.x:floorElevation.y;
   gl_Position=projectionMatrix*viewMatrix*world;`;
  const declarations='uniform vec3 arenaCenter;uniform vec2 arenaHalfSize,floorElevation;\n';
  const vertexShader=tapered?declarations+sources[0].material.vertexShader.replace('gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(tapered,1.);',project):declarations+`void main(){${project}}`;
  this.material=new T.ShaderMaterial({
   uniforms:{...(tapered?sources[0].material.uniforms:{}),...this.uniforms},vertexShader,
   fragmentShader:'uniform float attenuation;void main(){gl_FragColor=vec4(vec3(attenuation),1.);}',
   toneMapped:false,side:T.DoubleSide,depthTest:false,depthWrite:false,
   blending:T.CustomBlending,blendSrc:T.ZeroFactor,blendDst:T.SrcColorFactor,blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
   stencilWrite:true,stencilWriteMask:FLOOR_WALL_SHADOWS.stencilBit,stencilFuncMask:FLOOR_WALL_SHADOWS.stencilBit,stencilRef:FLOOR_WALL_SHADOWS.stencilBit,stencilFunc:T.NotEqualStencilFunc,stencilZPass:T.ReplaceStencilOp,
  });
  this.meshes=sources.map(source=>{
   const mesh=source.isInstancedMesh?new T.InstancedMesh(source.geometry,this.material,source.instanceMatrix.count):new T.Mesh(source.geometry,this.material);
   if(source.isInstancedMesh)mesh.instanceMatrix=source.instanceMatrix;
   mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.renderOrder=FLOOR_WALL_SHADOWS.renderOrder;this.group.add(mesh);return mesh;
  });
  this.material.onBeforeRender=()=>{this.uniforms.attenuation.value=1-FLOOR_WALL_SHADOWS.darkness*this.strengths[0];};
 }
 update(){
  this.group.visible=this.root.visible;
  if(!this.group.visible)return;
  this.root.updateWorldMatrix(true,true);this.group.updateWorldMatrix(true,false);this.inverse.copy(this.group.matrixWorld).invert();
  const arena=this.floors[0],ground=this.floors[1]??arena;
  arena.updateWorldMatrix(true,false);arena.getWorldPosition(this.arenaCenter);ground.getWorldPosition(this.floorPoint);
  this.uniforms.floorElevation.value.set(this.arenaCenter.y,this.floorPoint.y);
  this.uniforms.arenaHalfSize.value.set((arena.geometry.parameters.width??932)/2,(arena.geometry.parameters.height??932)/2);
  for(let i=0;i<this.sources.length;i++){
   const source=this.sources[i],mesh=this.meshes[i];source.updateWorldMatrix(true,false);
   mesh.geometry=source.geometry;mesh.visible=source.visible;mesh.matrix.multiplyMatrices(this.inverse,source.matrixWorld);
   if(source.isInstancedMesh)mesh.count=source.count;
  }
 }
 dispose(){this.group.removeFromParent();for(const mesh of this.meshes)if(mesh.isInstancedMesh)mesh.dispose();this.material.dispose();}
}
