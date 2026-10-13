import {compilePovCycle} from './pov-cycle-model.js';
import {csgKernelGLSL} from './csg-ray-kernel.js';
import {ARENA_FLOOR} from '../rendering/arena-floor.js';
import {Color} from 'three';
// Closed-form intersections, not distance-field ray marching. Units are meters,
// Y up, vehicle forward -Z. The POV-Ray model retains its original proportions.
export const CYCLE_RAY_CONFIG={lengthMeters:3.6,bodyColor:0xe6bd14,maxDistanceMeters:1000};
export const CYCLE_LIGHTING_CONFIG={ambientIntensity:.25,fillIntensity:.4,gridLineColor:0xcccccc};
export const CYCLE_EDGE_CONFIG={color:0x708396,strength:.55,grazingAngleCosine:.18};
export const cycleSceneGLSL=`
uniform vec3 bodyColor;
uniform bool shadows;
struct Hit {float t;vec3 n;int material;};
Hit emptyHit(){return Hit(1000.,vec3(0,1,0),0);}
#if defined(SHOW_CYCLE) || defined(CAST_SHADOWS)
${csgKernelGLSL}
${compilePovCycle()}
#endif
vec3 materialColor(int material){return material==1?bodyColor:material==2?vec3(.008,.011,.018):vec3(.32,.38,.48);}
// A continuous grazing-angle band avoids the broken 2x2 patterns from
// thresholding normal derivatives. Pixel-width filtering softens the band.
vec3 cycleEdgeHighlights(vec3 color,vec3 normal,vec3 viewDirection,int material){
 float facing=abs(dot(normal,viewDirection));
 float filterWidth=max(fwidth(facing),.025);
 float coverage=1.-smoothstep(${CYCLE_EDGE_CONFIG.grazingAngleCosine}-filterWidth,${CYCLE_EDGE_CONFIG.grazingAngleCosine}+filterWidth,facing);
 coverage*= ${CYCLE_EDGE_CONFIG.strength}*(material==1?.22:1.);
 vec3 ink=vec3(${new Color(CYCLE_EDGE_CONFIG.color).toArray().join(',')});
 return mix(color,max(color,ink),coverage);
}
vec3 lightingVisible(vec3 p,vec3 n,vec3 viewDirection,vec3 albedo,float gloss,float visibility){
 vec3 key=normalize(vec3(-1,2,-1)),fill=normalize(vec3(1,.5,1));
 vec3 ambient=mix(vec3(.075,.065,.11),vec3(.22,.28,.4),n.y*.5+.5)*${CYCLE_LIGHTING_CONFIG.ambientIntensity.toFixed(2)};
 float spec=pow(max(0.,dot(n,normalize(key+viewDirection))),gloss);
 return albedo*(ambient+vec3(.85,.92,1.)*max(0.,dot(n,key))*visibility+vec3(.2,.17,.28)*${CYCLE_LIGHTING_CONFIG.fillIntensity.toFixed(2)}*max(0.,dot(n,fill)))+vec3(.55,.65,.8)*spec*visibility;
}
vec3 lighting(vec3 p,vec3 n,vec3 viewDirection,vec3 albedo,float gloss){
 float visibility=1.;
#ifdef CAST_SHADOWS
 if(cycleHit(p+n*.002,normalize(vec3(-1,2,-1))).material!=0)visibility=.15;
#endif
 return lightingVisible(p,n,viewDirection,albedo,gloss,visibility);
}
vec3 displayColor(vec3 linearColor){vec3 c=max(linearColor,vec3(0));return mix(1.055*pow(c,vec3(1./2.4))-.055,c*12.92,lessThanEqual(c,vec3(.0031308)));}
`;
export const rayFragment=cycleSceneGLSL+`
uniform mat4 cameraWorld,inverseProjection,viewProjection;
uniform vec2 resolution;
uniform bool showCycle;
uniform int samples;
vec3 sampleRay(vec2 pixel){
 vec2 uv=pixel/resolution*2.-1.;
 vec4 direction=inverseProjection*vec4(uv,1,1);
 vec3 ro=cameraWorld[3].xyz,rd=normalize(mat3(cameraWorld)*(direction.xyz/direction.w));
 Hit h=emptyHit();
#ifdef SHOW_CYCLE
 h=cycleHit(ro,rd);
#endif
 float floorT=rd.y<-.00001?-ro.y/rd.y:1000.;
 vec3 color=vec3(.002,.005,.012),p;
 if(floorT>0.&&floorT<h.t){
  h=Hit(floorT,vec3(0,1,0),4);p=ro+rd*h.t;
  vec2 cell=abs(fract(p.xz/${ARENA_FLOOR.gridMeters}+.5)-.5)*${ARENA_FLOOR.gridMeters};
  vec2 aa=max(fwidth(p.xz)*${ARENA_FLOOR.antialiasScale},vec2(.00001));
  vec2 lines=(1.-smoothstep(vec2(${ARENA_FLOOR.lineHalfWidthMeters}),vec2(${ARENA_FLOOR.lineHalfWidthMeters})+aa,cell))*min(vec2(1.),vec2(${2*ARENA_FLOOR.lineHalfWidthMeters})/aa);
  float grid=max(lines.x,lines.y)*(1.-smoothstep(${ARENA_FLOOR.fadeStartMeters.toFixed(1)},${ARENA_FLOOR.fadeEndMeters.toFixed(1)},h.t));
  color=mix(vec3(${new Color(ARENA_FLOOR.backgroundColor).toArray().join(',')}),vec3(${new Color(CYCLE_LIGHTING_CONFIG.gridLineColor).toArray().join(',')}),grid);
#ifdef CAST_SHADOWS
  if(cycleHit(p+vec3(0,.002,0),normalize(vec3(-1,2,-1))).material!=0)color*=.15;
#endif
 }else if(h.material!=0){p=ro+rd*h.t;color=lighting(p,h.n,-rd,materialColor(h.material),h.material==2?90.:45.);
#ifdef SHOW_CYCLE
 color=cycleEdgeHighlights(color,h.n,-rd,h.material);
#endif
}
 if(h.material!=0){vec4 clip=viewProjection*vec4(ro+rd*h.t,1);gl_FragDepth=clip.z/clip.w*.5+.5;}else gl_FragDepth=1.;
 return color;
}
void main(){
 vec3 color=vec3(0);
 if(samples==1)color=sampleRay(gl_FragCoord.xy);
 else {for(int i=0;i<4;i++){vec2 offset=vec2(float(i%2),float(i/2))*.5-.25;color+=sampleRay(gl_FragCoord.xy+offset)*.25;}}
 gl_FragColor=vec4(displayColor(color),1.);
}
`;
export const meshVertex=`varying vec3 worldPoint,worldNormal;void main(){vec4 p=modelMatrix*vec4(position,1);worldPoint=p.xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`;
export const meshFragment=cycleSceneGLSL+`uniform vec3 albedo;uniform bool painted;varying vec3 worldPoint,worldNormal;void main(){vec3 c=painted?bodyColor:albedo;gl_FragColor=vec4(displayColor(lighting(worldPoint,normalize(worldNormal),normalize(cameraPosition-worldPoint),c,dot(c,c)<.02?90.:45.)),1);}`;
