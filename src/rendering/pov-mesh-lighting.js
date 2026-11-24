// Lights the POV-Ray cycle mesh (normal renderer fallback) with the POV-Ray
// renderer's own shading: the same key/fill/ambient model and Blinn highlight
// (lightingVisible), grazing-edge ink, side-window return fill, and the flickering
// wheel spoke glint. Standard material stages before and after stay in place: the
// human stripe still paints diffuseColor, and cast shadows still darken the result.
import * as THREE from 'three';
import {cycleSceneGLSL,CYCLE_LIGHTING_CONFIG,CYCLE_EDGE_CONFIG} from '../experiments/cycle-ray-shader.js';
import {CYCLE_WHEEL_REFLECTIONS,wheelReflectionGLSL} from './cycle-wheel-reflections.js';
import {POV_CYCLE_SCALE} from '../experiments/pov-cycle-model.js';

// The tyres' hollow sides are small concave pockets that a shadow map cannot
// resolve; POV-Ray's shadow ray leaves them dark. Trace that ray against the two
// tyres exactly (each a sphere minus two side spheres, as in pov-cycle-model.js),
// in POV-Ray source units. Larger occluders are left to the cast-shadow map.
const f=n=>Number(n).toFixed(6);
const tyreShadowGLSL=`
vec2 povSphereSpan(vec3 o,vec3 d,vec3 c,float r){vec3 oc=o-c;float b=dot(oc,d),q=dot(oc,oc)-r*r,h=b*b-q;if(h<0.)return vec2(1e9,-1e9);h=sqrt(h);return vec2(-b-h,-b+h);}
// Is any of the outer sphere's span ahead of the point left after removing both side cuts?
bool povSpanSurvives(vec2 outer,vec2 a,vec2 b){
 float lo=max(outer.x,.5),hi=outer.y;
 if(a.x>b.x){vec2 t=a;a=b;b=t;}
 if(a.x<=lo&&a.y>lo)lo=a.y;
 if(b.x<=lo&&b.y>lo)lo=b.y;
 return lo<hi;
}
bool povTyreShadow(vec3 game,vec3 gameKey){
 vec3 o=vec3(177.5-game.z/${f(POV_CYCLE_SCALE)},game.y/${f(POV_CYCLE_SCALE)},game.x/${f(POV_CYCLE_SCALE)}),d=normalize(vec3(-gameKey.z,gameKey.y,gameKey.x));
 // Front tyre: sphere(355,85,0; 85) minus spheres (355,85,±57.1615; 57.0742).
 if(povSpanSurvives(povSphereSpan(o,d,vec3(355.,85.,0.),85.),povSphereSpan(o,d,vec3(355.,85.,57.1615),57.0742),povSphereSpan(o,d,vec3(355.,85.,-57.1615),57.0742)))return true;
 // Rear tyre: sphere(0,85,0; 85) squashed to 0.2 along Z, minus true spheres (0,85,±20.8732; 58.7155).
 // In the squashed sphere's space z is 5x; k converts its distances back to source distances.
 vec3 sd=vec3(d.xy,d.z*5.);float k=length(sd);
 vec2 outer=povSphereSpan(vec3(o.xy,o.z*5.),sd/k,vec3(0.,85.,0.),85.)/k;
 return povSpanSurvives(outer,povSphereSpan(o,d,vec3(0.,85.,20.8732),58.7155),povSphereSpan(o,d,vec3(0.,85.,-20.8732),58.7155));
}
`;

/** glTF material name -> POV-Ray material number (see tools/assets/pov-cycle-mesh.mjs). */
export const POV_MESH_MATERIALS=Object.freeze({Color_D06:1,black:2,_LightGray_1:3,WindowReturn:4});

/** Per-cycle uniforms, shared by that cycle's materials; light-cycles.js advances them. */
export const createPovMeshUniforms=()=>({wheelPhase:{value:0},wheelGlintStrength:{value:0}});

/** Install on one cycle's own (cloned) materials, before the stripe and shadow patches wrap them. */
export function applyPovMeshLighting(root,uniforms=createPovMeshUniforms()){
  root.userData.povUniforms=uniforms;
  const materials=new Set();root.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>materials.add(m));});
  for(const material of materials){
    const povMaterial=POV_MESH_MATERIALS[material.name];if(!povMaterial)continue;
    material.onBeforeCompile=shader=>{
      shader.uniforms.wheelPhase=uniforms.wheelPhase;shader.uniforms.wheelGlintStrength=uniforms.wheelGlintStrength;
      shader.vertexShader='varying vec3 povLocal,povLocalNormal,povWorld,povLocalKey;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\npovLocal=position;povLocalNormal=normal;povWorld=(modelMatrix*vec4(position,1.)).xyz;povLocalKey=normalize(transpose(mat3(modelMatrix))*normalize(vec3(-1.,2.,-1.)));');
      shader.fragmentShader='varying vec3 povLocal,povLocalNormal,povWorld,povLocalKey;\n'+cycleSceneGLSL+wheelReflectionGLSL+tyreShadowGLSL+shader.fragmentShader.replace('#include <opaque_fragment>',`
 float povGlint=0.;
 {
  const int povMaterial=${povMaterial};
  vec3 povNormal=normalize(inverseTransformDirection(normal,viewMatrix)),povView=normalize(cameraPosition-povWorld);
  float povKey=povTyreShadow(povLocal+normalize(povLocalNormal)*.002,povLocalKey)?${CYCLE_LIGHTING_CONFIG.occludedKeyIntensity.toFixed(2)}:1.;
  vec3 povColor=lightingVisible(povWorld,povNormal,povView,diffuseColor.rgb,povMaterial==2?90.:45.,povKey);
  if(povMaterial==4)povColor=max(povColor,materialColor(3)*${CYCLE_LIGHTING_CONFIG.windowReturnFill});
  povColor=cycleEdgeHighlights(povColor,povNormal,povView,povMaterial);
  povGlint=wheelReflection(povLocal,normalize(povLocalNormal),povMaterial);
  outgoingLight=povColor;
 }
#include <opaque_fragment>`).replace('#include <tonemapping_fragment>',`#include <tonemapping_fragment>
 // The glint is a reflection, not lit surface: like POV-Ray, cast shadows (applied
 // just before this point by later patches) do not dim it.
 gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.82,.89,1.)*${CYCLE_WHEEL_REFLECTIONS.intensity},povGlint);`);
    };
    material.customProgramCacheKey=()=>`pov-mesh-lighting-v3-${povMaterial}`;
  }
}

// The in-game POV-Ray renderer inks creases found in a normal-difference edge map
// (strength 0.8, 0.22 of that on paint, from about 10 degrees). The mesh knows its
// creases exactly: the converter shares vertices across each smooth surface and
// splits them only where surfaces meet. Ink an edge where the two triangles do not
// share its vertices and meet at more than creaseDegrees, never a tessellation
// facet. Additive light ink over the near-black surfaces, faint on paint.
export const POV_MESH_INK=Object.freeze({creaseDegrees:10,strength:.8,paintStrength:.22,name:'POV cycle ink'});
export function povMeshCreases(meshes,creaseDegrees=POV_MESH_INK.creaseDegrees){
  const edges=new Map(),q=v=>Math.round(v*1e5),cos=Math.cos(creaseDegrees*Math.PI/180);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  meshes.forEach((mesh,m)=>{
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index.array;
    for(let t=0;t<index.length;t+=3){
      const ids=[index[t],index[t+1],index[t+2]];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
      const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      for(let k=0;k<3;k++){
        const i=ids[k],j=ids[(k+1)%3],ki=[q(p.getX(i)),q(p.getY(i)),q(p.getZ(i))].join(),kj=[q(p.getX(j)),q(p.getY(j)),q(p.getZ(j))].join();
        const key=ki<kj?ki+'|'+kj:kj+'|'+ki,id=`${m}:${Math.min(i,j)}:${Math.max(i,j)}`;
        (edges.get(key)??edges.set(key,{m,i,j,faces:[]}).get(key)).faces.push({id,n,m});
      }
    }
  });
  const out=new Map(); // mesh index -> positions
  for(const e of edges.values()){
    const crease=e.faces.some((f,x)=>e.faces.some((g,y)=>y>x&&f.id!==g.id&&f.n.dot(g.n)<cos&&f.n.dot(g.n)>-.9));
    if(!crease)continue;
    const p=meshes[e.m].geometry.attributes.position,list=out.get(e.m)??out.set(e.m,[]).get(e.m);
    list.push(p.getX(e.i),p.getY(e.i),p.getZ(e.i),p.getX(e.j),p.getY(e.j),p.getZ(e.j));
  }
  return out;
}
export function createPovMeshInk(root){
  const ink=new THREE.Color(CYCLE_EDGE_CONFIG.color),group=new THREE.Group();group.name=POV_MESH_INK.name;
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);}); // authored at the model origin (identity transforms)
  // Assign each crease to the brighter-inked side: dark materials take full ink, paint a little.
  const creases=povMeshCreases(meshes),byPaint=new Map();
  for(const [m,positions] of creases){const paint=meshes[m].material.name==='Color_D06';(byPaint.get(paint)??byPaint.set(paint,[]).get(paint)).push(...positions);}
  for(const [paint,positions] of byPaint){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const material=new THREE.LineBasicMaterial({color:ink.clone().multiplyScalar(POV_MESH_INK.strength*(paint?POV_MESH_INK.paintStrength:1)),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
    const lines=new THREE.LineSegments(geometry,material);lines.name=`${POV_MESH_INK.name} (${paint?'paint':'dark'})`;lines.userData.breakupExclude=true;group.add(lines);
  }
  // Lines lie on the surface; push the surfaces back a little so they draw on top.
  for(const mesh of meshes)Object.assign(mesh.material,{polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  root.add(group);return group;
}
