import {TELEPORT_PADS} from '../levels/teleporters.js';
import {GROUND_GRID_LINE_HALF_WIDTH,GROUND_GRID_AA_SCALE} from '../levels/ground-grid.js';

// Paint the borders directly into the floor. Sharing its depth and derivatives
// eliminates the competing near-coplanar surface at shallow camera angles.
export function createTeleporters(material){
 const visible={value:1},previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous?.(shader);shader.uniforms.teleportPadsVisible=visible;
  shader.fragmentShader='uniform float teleportPadsVisible;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec2 padAA=fwidth(vGround.xz)*${GROUND_GRID_AA_SCALE.toFixed(1)};
   float padBorder=0.;
   ${TELEPORT_PADS.map(p=>`{
    vec2 p=abs(vGround.xz-vec2(${p.x.toFixed(1)},${(-p.s).toFixed(1)}));
    vec2 edge=abs(p-vec2(${(p.size/2).toFixed(1)}));
    vec2 line=1.-smoothstep(vec2(${GROUND_GRID_LINE_HALF_WIDTH.toFixed(2)}),vec2(${GROUND_GRID_LINE_HALF_WIDTH.toFixed(2)})+padAA,edge);
    vec2 span=1.-smoothstep(vec2(${(p.size/2).toFixed(1)}),vec2(${(p.size/2).toFixed(1)})+padAA,p);
    padBorder=max(padBorder,max(line.x*span.y,line.y*span.x));
   }`).join('\n')}
   outgoingLight=mix(outgoingLight,vec3(3.,.008,.003),padBorder*teleportPadsVisible);
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>key+'|floor-teleport-borders-v2';material.needsUpdate=true;
 return {get visible(){return !!visible.value;},set visible(value){visible.value=Number(value);}};
}
