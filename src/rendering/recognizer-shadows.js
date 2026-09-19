import * as T from 'three';
// One compact light-space tile per aircraft: stable detail across distant mazes.
export class RecognizerShadows {
 constructor(crafts,receivers,maxBursts=5,{size=512,prefix='recShadow',darkness=.78,excludeSelf=false}={}){
  const named=code=>code.replaceAll('recShadow',prefix);
  this.size=size;this.columns=Math.min(4,crafts.length+maxBursts);this.rows=Math.ceil((crafts.length+maxBursts)/this.columns);
  this.target=new T.WebGLRenderTarget(this.size*this.columns,this.size*this.rows,{minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  this.depth=new T.MeshDepthMaterial({depthPacking:excludeSelf?T.RGDepthPacking:T.RGBADepthPacking,side:T.DoubleSide,blending:T.NoBlending});
  // Maze maps store 16-bit depth plus a 16-bit slab identity. Zero denotes
  // ordinary receivers (vehicles), which must receive every slab's shadow.
  if(excludeSelf)this.depth.onBeforeCompile=shader=>{
   shader.vertexShader='attribute float shadowWallId;varying float casterWallId;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n casterWallId=shadowWallId;');
   shader.fragmentShader='varying float casterWallId;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );','gl_FragColor = vec4(packDepthToRG(fragCoordZ),mod(casterWallId,256.)/255.,floor(casterWallId/256.)/255.);');
  };
  this.bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  this.entries=crafts.map(craft=>{
   const scene=new T.Scene(),pairs=[];
   const sources=craft.casters||[];if(!craft.casters)craft.root.traverse(o=>{if(o.isMesh&&o.material.name==='Base'&&!o.userData.breakupExclude)sources.push(o);});
   for(const source of sources){const mesh=new T.Mesh(source.geometry,this.depth);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;scene.add(mesh);pairs.push({source,mesh});}
   const radius=craft.radius||25;const camera=new T.OrthographicCamera(-radius,radius,radius,-radius,.1,craft.distance?craft.distance*2.5:900);
   return {craft,scene,pairs,camera,matrix:new T.Matrix4()};
  });
  this.craftCount=this.entries.length;
  for(let i=0;i<maxBursts;i++)this.entries.push({scene:new T.Scene(),pairs:[],camera:new T.OrthographicCamera(-25,25,25,-25,.1,2000),matrix:new T.Matrix4().makeTranslation(1e9,1e9,1e9),burst:null});
  this.strengths=new Float32Array(this.entries.length).fill(1);
  const patched=new Set();
  for(const receiver of receivers){
   const material=receiver.material;if(patched.has(material))continue;patched.add(material);
   const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
   material.onBeforeCompile=shader=>{
    previous?.(shader);
    if(excludeSelf){
     shader.vertexShader='attribute float shadowWallId;varying float receiverWallId;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n receiverWallId=shadowWallId;');
     shader.fragmentShader='varying float receiverWallId;\n'+shader.fragmentShader;
    }
    shader.uniforms[prefix+'Strength']={value:this.strengths};shader.uniforms[prefix+'Atlas']={value:this.target.texture};shader.uniforms[prefix+'Matrices']={value:this.entries.map(e=>e.matrix)};
    shader.vertexShader=named('varying vec3 recShadowWorld;\n')+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',named('#include <begin_vertex>\n recShadowWorld=(modelMatrix*vec4(position,1.)).xyz;'));
    shader.fragmentShader=named(`uniform sampler2D recShadowAtlas;uniform mat4 recShadowMatrices[${this.entries.length}];uniform float recShadowStrength[${this.entries.length}];varying vec3 recShadowWorld;\n`)+shader.fragmentShader;
    if(!shader.fragmentShader.includes('#include <packing>'))shader.fragmentShader='#include <packing>\n'+shader.fragmentShader;
    const tests=this.entries.map((_,i)=>`{
     vec4 projected=recShadowMatrices[${i}]*vec4(recShadowWorld,1.);vec3 p=projected.xyz/projected.w;
     // Compare depth at the actual sampled texel center on the receiver plane.
     // This removes the per-triangle acne caused by an uncorrected nearest
     // depth sample, especially at oblique angles and distant maze coordinates.
     vec3 px=dFdx(p),py=dFdy(p);
     float det=px.x*py.y-px.y*py.x;
     vec2 slope=abs(det)>1e-20?vec2(px.z*py.y-py.z*px.y,py.z*px.x-px.z*py.x)/det:vec2(0.);
     if(all(greaterThan(p,vec3(0.)))&&all(lessThan(p,vec3(1.)))){
      vec2 local=(clamp(floor(p.xy*${this.size}.),vec2(0.),vec2(${this.size-1}.))+.5)/${this.size}.;
      vec2 uv=(local+vec2(${i%this.columns}.,${Math.floor(i/this.columns)}.))/vec2(${this.columns}.,${this.rows}.);
      float receiverDepth=p.z+dot(slope,local-p.xy);
      float depthBias=.0002+.75*(abs(slope.x)+abs(slope.y))/${this.size}.;
      vec4 sampleDepth=texture2D(recShadowAtlas,uv);
      float cover=step(${excludeSelf?'unpackRGToDepth(sampleDepth.rg)':'unpackRGBAToDepth(sampleDepth)'}+depthBias,receiverDepth);
      ${excludeSelf?`float casterId=floor(sampleDepth.b*255.+.5)+256.*floor(sampleDepth.a*255.+.5);
      if(receiverWallId>.5&&abs(casterId-receiverWallId)<.5)cover=0.;`:''}
      recShadowShade=min(recShadowShade,1.-${darkness.toFixed(3)}*cover*recShadowStrength[${i}]);
     }
    }`).join('\n');
    const emissive=shader.fragmentShader.includes('totalEmissiveRadiance')?' + totalEmissiveRadiance*(1.-recShadowShade)':'';
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',named(`float recShadowShade=1.;\n${tests}\ngl_FragColor.rgb=gl_FragColor.rgb*recShadowShade${emissive};\n#include <tonemapping_fragment>`));
   };
   material.customProgramCacheKey=()=>`${previousKey}|${prefix}:${size}:${darkness}:receiver-plane-v3:${excludeSelf}:${this.entries.length}`;
   material.needsUpdate=true;
  }
 }
 update(renderer,bursts=[]){
  const oldTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
  renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.setClearColor(0xffffff,1);renderer.clear();renderer.autoClear=false;renderer.setScissorTest(true);
  this.entries.forEach((e,i)=>{
   const center=new T.Vector3();
   if(e.craft){
    e.craft.root.updateWorldMatrix(true,true);e.craft.root.getWorldPosition(center);
    if(!e.craft.root.visible){e.matrix.makeTranslation(1e9,1e9,1e9);return;}
    const distance=e.craft.distance||400;e.camera.position.copy(center).add(new T.Vector3(-distance*.5,distance,-distance*.5));
   }else{
    const burst=bursts[i-this.craftCount];
    if(e.burst!==burst){
     e.scene.clear();e.pairs=[];e.burst=burst;
     for(const piece of burst?.pieces||[])piece.group.traverse(source=>{
      if(!source.isMesh||source.userData.breakupExclude)return;
      const mesh=new T.Mesh(source.geometry,this.depth);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;e.scene.add(mesh);e.pairs.push({source,mesh});
     });
    }
    if(!burst){e.matrix.makeTranslation(1e9,1e9,1e9);return;}
    const box=new T.Box3();
    for(const piece of burst.pieces){piece.group.updateWorldMatrix(true,true);box.expandByObject(piece.group);}
    box.getCenter(center);const radius=Math.max(25,box.getSize(new T.Vector3()).length()*.55);
    e.camera.left=e.camera.bottom=-radius;e.camera.right=e.camera.top=radius;e.camera.updateProjectionMatrix();
    e.camera.position.copy(center).add(new T.Vector3(-400,800,-400));
    this.strengths[i]=Math.max(0,Math.min(1,(burst.life-burst.age)/burst.motion.fade));
   }
   e.camera.lookAt(center);e.camera.updateMatrixWorld(true);
   e.matrix.copy(this.bias).multiply(e.camera.projectionMatrix).multiply(e.camera.matrixWorldInverse);
   for(const {source,mesh} of e.pairs){source.updateWorldMatrix(true,false);mesh.matrix.copy(source.matrixWorld);}
   const x=i%this.columns*this.size,y=Math.floor(i/this.columns)*this.size;
   // Render-target rectangles are physical texels. Renderer.setViewport/Scissor
   // would multiply these by the display pixel ratio, corrupting later tiles.
   this.target.viewport.set(x,y,this.size,this.size);this.target.scissor.set(x,y,this.size,this.size);this.target.scissorTest=true;
   renderer.setRenderTarget(this.target);renderer.render(e.scene,e.camera);
  });
  renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(color,alpha);renderer.autoClear=autoClear;
 }
 dispose(){this.target.dispose();this.depth.dispose();}
}
