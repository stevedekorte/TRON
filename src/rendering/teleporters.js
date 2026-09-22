import {TELEPORT_PADS,TELEPORTERS} from '../levels/teleporters.js';
import {GROUND_GRID_LINE_HALF_WIDTH,GROUND_GRID_AA_SCALE} from '../levels/ground-grid.js';

// Paint the borders directly into the floor. Sharing its depth and derivatives
// eliminates the competing near-coplanar surface at shallow camera angles.
export function createTeleporters(material){
 const visible={value:1},pulses={value:new Float32Array(TELEPORT_PADS.length)},previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous?.(shader);shader.uniforms.teleportPadsVisible=visible;shader.uniforms.teleportPadPulse=pulses;
  shader.fragmentShader=`uniform float teleportPadPulse[${TELEPORT_PADS.length}];uniform float teleportPadsVisible;\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec2 padAA=fwidth(vGround.xz)*${GROUND_GRID_AA_SCALE.toFixed(1)};
   // A grazing pixel can cover kilometers of floor. Never expand a finite
   // pad by that unbounded footprint: fade subpixel pads instead.
   float padFootprint=max(padAA.x,padAA.y);
   float padVisibility=1.-smoothstep(${(TELEPORTERS.size/8).toFixed(1)},${(TELEPORTERS.size/2).toFixed(1)},padFootprint);
   padAA=clamp(padAA,vec2(.001),vec2(${(TELEPORTERS.size/8).toFixed(1)}));
   float padBorder=0.;float padPulse=0.;
   ${TELEPORT_PADS.map((p,i)=>`{
    vec2 p=abs(vGround.xz-vec2(${p.x.toFixed(1)},${(-p.s).toFixed(1)}));
    vec2 edge=abs(p-vec2(${(p.size/2).toFixed(1)}));
    vec2 line=1.-smoothstep(vec2(${GROUND_GRID_LINE_HALF_WIDTH.toFixed(2)}),vec2(${GROUND_GRID_LINE_HALF_WIDTH.toFixed(2)})+padAA,edge);
    vec2 span=1.-smoothstep(vec2(${(p.size/2).toFixed(1)}),vec2(${(p.size/2).toFixed(1)})+padAA,p);
    padBorder=max(padBorder,max(line.x*span.y,line.y*span.x));
    padPulse=max(padPulse,teleportPadPulse[${i}]*max(line.x*span.y,line.y*span.x));
   }`).join('\n')}
   outgoingLight=mix(outgoingLight,vec3(3.,.008,.003),padBorder*padVisibility*teleportPadsVisible);
   outgoingLight+=vec3(1.5,.22,.08)*padPulse*padVisibility*teleportPadsVisible;
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>key+'|floor-teleport-borders-v4';material.needsUpdate=true;
 return {update(pads,time){for(let i=0;i<TELEPORT_PADS.length;i++){const pad=pads.find(p=>p.id===TELEPORT_PADS[i].id);pulses.value[i]=pad?.lastTransfer==null?0:Math.max(0,1-(time-pad.lastTransfer)/TELEPORTERS.pulseSeconds);}},get visible(){return !!visible.value;},set visible(value){visible.value=Number(value);}};
}
