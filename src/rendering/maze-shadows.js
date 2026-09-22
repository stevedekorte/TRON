import {DEFAULT_WORLD,worldFor} from '../levels/scenario.js';
import * as T from 'three';
import {createStaticWallShadowGeometry} from './static-wall-shadows.js';
import {RecognizerShadows} from './recognizer-shadows.js';
// The maze is static: render its depth maps once, independently of moving casters.
export class MazeShadows extends RecognizerShadows{
 constructor(world,vehicles=[],map=DEFAULT_WORLD){
  const {MAZE_INSTANCES,MAZE_LENGTH,WALL_HEIGHT}=map;
  // The shallow decorative ledges are smaller than a shadow texel. Casting
  // them into the slab's own map creates alternating triangle-shaped patches.
  // Use the shared solid wall prisms for casting, retain relief as receivers.
  const positions=world.slabs.userData.shadowPositions;
  const casterGeometry=positions?new T.BufferGeometry():null;
  if(casterGeometry){casterGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));casterGeometry.setAttribute('shadowWallId',new T.Float32BufferAttribute(world.slabs.userData.shadowIds,1));}
  const caster=casterGeometry?new T.Mesh(casterGeometry):world.slabs;caster.updateMatrixWorld(true);
  const casters=MAZE_INSTANCES.map(m=>{
   const root=new T.Group();root.position.set(m.x,WALL_HEIGHT/2,-m.s);
   return {root,casters:[caster],radius:MAZE_LENGTH*.85,distance:MAZE_LENGTH*2};
  });
  const darkness=.4;
  const receivers=[];
  for(const root of vehicles)root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)receivers.push(o);});
  super(casters,receivers,0,{size:1024,prefix:'mazeShadow',darkness,excludeSelf:true});
  this.casterGeometry=casterGeometry;if(casterGeometry)caster.material.dispose();
  // Project exact slab geometry onto the floor and multiply its existing color.
  // Stencil bit 0 makes the operation a union: overlapping triangles/slabs
  // darken each sample only once, preserving grid lines without map stair steps.
  const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,side:T.DoubleSide,
   blending:T.CustomBlending,blendSrc:T.ZeroFactor,blendDst:T.SrcColorFactor,
   blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
   stencilWrite:true,stencilWriteMask:1,stencilFuncMask:1,stencilRef:1,
   stencilFunc:T.NotEqualStencilFunc,stencilZPass:T.ReplaceStencilOp,
   uniforms:{attenuation:{value:1-darkness}},
   vertexShader:`void main(){vec4 p=modelMatrix*vec4(position,1.);p.xz+=vec2(.5)*max(0.,p.y);p.y=-.06;gl_Position=projectionMatrix*viewMatrix*p;}`,
   fragmentShader:'uniform float attenuation;void main(){gl_FragColor=vec4(vec3(attenuation),1.);}'
  });
  this.floorShadow=new T.Mesh(world.slabs.geometry,material);this.floorShadow.frustumCulled=false;this.floorShadow.renderOrder=-1.5;
  this.floorShadow.matrixAutoUpdate=false;
  this.floorShadow.onBeforeRender=()=>{world.slabs.updateWorldMatrix(true,false);this.floorShadow.matrixWorld.copy(world.slabs.matrixWorld);};
  world.slabs.parent.add(this.floorShadow);
  const wallMaterial=material.clone();wallMaterial.depthTest=true;wallMaterial.polygonOffset=true;wallMaterial.polygonOffsetFactor=-1;wallMaterial.polygonOffsetUnits=-1;
  wallMaterial.stencilWriteMask=wallMaterial.stencilFuncMask=wallMaterial.stencilRef=2;
  wallMaterial.vertexShader='void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  this.wallShadow=new T.Mesh(createStaticWallShadowGeometry(world.slabs,casterGeometry||world.slabs.geometry),wallMaterial);
  this.wallShadow.renderOrder=.5;world.slabs.parent.add(this.wallShadow);
 }
 dispose(){super.dispose();this.casterGeometry?.dispose();this.floorShadow.material.dispose();this.floorShadow.removeFromParent();this.wallShadow.geometry.dispose();this.wallShadow.material.dispose();this.wallShadow.removeFromParent();}
 update(renderer){if(this.ready)return;super.update(renderer);this.ready=true;}
}
