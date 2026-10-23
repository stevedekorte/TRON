import {WebGLRenderTarget,HalfFloatType} from 'three';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';

// Resolve the scene once into a finite HDR image before postprocessing.
// Bloom blends in place and propagates invalid scene pixels across its mips.
export class AntialiasedScenePass extends RenderPass {
  constructor(scene,camera,samples){
    super(scene,camera);
    this.target=new WebGLRenderTarget(1,1,{type:HalfFloatType,samples,stencilBuffer:true});
    // A single NaN/Infinity can contaminate every bloom mip. Keep scene
    // radiance finite before any filtering; 1024 leaves ample HDR headroom.
    this.copy=new ShaderPass({...CopyShader,fragmentShader:CopyShader.fragmentShader.replace(
      'gl_FragColor = opacity * texel;',
      `texel = vec4(isnan(texel.x) ? 0. : texel.x,
                    isnan(texel.y) ? 0. : texel.y,
                    isnan(texel.z) ? 0. : texel.z,
                    isnan(texel.w) ? 1. : texel.w);
       gl_FragColor = opacity * clamp(texel, vec4(0.), vec4(1024.));`
    )});
    this.copy.material.depthTest=false;this.copy.material.depthWrite=false;
    this.copy.clear=true;
  }
  setSize(width,height){this.target.setSize(Math.max(1,Math.floor(width)),Math.max(1,Math.floor(height)));}
  setSamples(samples){if(this.target.samples!==samples){this.target.dispose();this.target.samples=samples;}}
  render(renderer,writeBuffer,readBuffer,dt,maskActive){
    super.render(renderer,writeBuffer,this.target,dt,maskActive);
    this.copy.render(renderer,readBuffer,this.target,dt,maskActive);
  }
  dispose(){this.target.dispose();this.copy.dispose();}
}
