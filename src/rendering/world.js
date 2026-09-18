import * as THREE from 'three';
import { MAZE_INSTANCES, WALLS, WALL_HEIGHT, HALF, FLOOR_HALF, BASIS, wallAt } from '../levels/maze.js';

// Preserve near fog exactly; distant geometry keeps a readable silhouette.
function distantFog(shader,falloff=200){
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',THREE.ShaderChunk.fog_fragment.replace('fogDensity * fogDensity * vFogDepth * vFogDepth', 'fogDensity * fogDensity * readableDepth * readableDepth').replace('#ifdef FOG_EXP2', `#ifdef FOG_EXP2\n float readableDepth = vFogDepth <= 250. ? vFogDepth : 250. + ${falloff.toFixed(1)} * (1. - exp(-(vFogDepth - 250.) / ${falloff.toFixed(1)}));`));
}
export function createWorld(scene) {
  const positions=[],colors=[],exposed=[];
  function quad(a,b,c,d,tone) {for(const p of [a,b,c,a,c,d]){positions.push(...p);colors.push(...tone);}}
  for(const w of WALLS) {
    const h=WALL_HEIGHT;
    const roof=[.035,.075,.19];
    for(const tri of THREE.ShapeUtils.triangulateShape(w.points.map(p=>new THREE.Vector2(p.x,p.s)),[]))for(const p of tri.map(i=>w.points[i])){positions.push(p.x,h,-p.s);colors.push(...roof);}
    for(const edge of w.edges) {
      const {a,b,nx,ns}=edge;
      if(wallAt((a.x+b.x)/2+nx*.1,(a.s+b.s)/2+ns*.1))continue;
      exposed.push(edge);
      const shade=1+nx*.25-ns*.12;
      quad([a.x,0,-a.s],[b.x,0,-b.s],[b.x,h,-b.s],[a.x,h,-a.s],[.004*shade,.007*shade,.017*shade]);

    }
  }
  // Join collinear cell boundaries before detailing, so the underlying maze
  // grid does not turn into a visible checkerboard of panel seams.
  const key=p=>p.x.toFixed(4)+','+p.s.toFixed(4);
  const starts=new Map(exposed.map(e=>[key(e.a),e])), used=new Set(), faces=[];
  for(const first of exposed) {
    if(used.has(first))continue;
    let edge=first;used.add(edge);let end=edge.b;
    while(true) {
      const next=starts.get(key(end));
      if(!next||used.has(next)||Math.abs(next.nx-first.nx)+Math.abs(next.ns-first.ns)>.001)break;
      used.add(next);end=next.b;
    }
    faces.push({...first,b:end});
  }
  const lines=[],corners=new Map();
  const line=(a,b)=>lines.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
  for(const {a,b,nx,ns} of faces) {
    const length=Math.hypot(b.x-a.x,b.s-a.s);
    const p=(distance,y,out=.035)=>[a.x+(b.x-a.x)*distance/length+nx*out,y,-a.s-(b.s-a.s)*distance/length-ns*out];
    line(p(0,WALL_HEIGHT-.12),p(length,WALL_HEIGHT-.12));
    for(const point of [a,b]) {
      const k=key(point),list=corners.get(k)||[];list.push({point,nx,ns});corners.set(k,list);
    }
    if(length<28)continue;
    // Sparse, tall inset faces above shallow beveled lower ledges.
    const count=Math.max(1,Math.floor(length/85)),span=length/count;
    for(let i=0;i<count;i++) {
      const left=i*span+3,right=(i+1)*span-3;
      const low=9,high=WALL_HEIGHT-5,cut=2.2,depth=.3;
      line(p(left,low+2),p(left,high-cut));
      line(p(left,high-cut),p(left+cut,high));
      line(p(left+cut,high),p(right,high));
      line(p(right,high),p(right,low+2));
      // A dark upright lip with a brighter sloped top reads as actual relief.
      quad(p(left,low-1),p(right,low-1),p(right,low+.65,depth),p(left,low+.65,depth),[.003,.005,.012]);
      quad(p(left,low+.65,depth),p(right,low+.65,depth),p(right-cut,low+1.15),p(left+cut,low+1.15),[.026,.042,.075]);
      line(p(left,low+.65,depth+.01),p(right,low+.65,depth+.01));
      quad(p(left,low-1),p(left,low+.65,depth),p(left+cut,low+1.15),p(left+cut,low-1),[.012,.022,.045]);
    }
  }
  // Vertical seams only at silhouette corners, not between coplanar cells.
  for(const items of corners.values()) {
    if(items.length<2||items.every(e=>Math.abs(e.nx-items[0].nx)+Math.abs(e.ns-items[0].ns)<.001))continue;
    const {point}=items[0],nx=items.reduce((v,e)=>v+e.nx,0)*.035,ns=items.reduce((v,e)=>v+e.ns,0)*.035;
    line([point.x+nx,.25,-point.s-ns],[point.x+nx,WALL_HEIGHT-.15,-point.s-ns]);
  }
  const seams=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),
    new THREE.LineBasicMaterial({color:0x354963,transparent:true,opacity:.68,depthWrite:false}));
  seams.material.onBeforeCompile=shader=>distantFog(shader,120);
  scene.add(seams);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const slabMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  slabMaterial.onBeforeCompile=shader=>{
    distantFog(shader,120);
    shader.vertexShader='varying vec3 vSlab;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSlab=position;');
    shader.fragmentShader='varying vec3 vSlab;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      // Continuous broad washes across joined cells, never a tile-by-tile tint.
      float wash=.85+.15*sin(vSlab.x*.002-vSlab.z*.003);
      diffuseColor.rgb*=wash;
      // Lift far silhouettes gradually, without altering nearby surface colors.
      float distantReadability=smoothstep(350.,1600.,distance(cameraPosition.xz,vSlab.xz));
      diffuseColor.rgb+=vec3(.005,.012,.028)*distantReadability;`);
  };
  const slabs=new THREE.Mesh(geometry,slabMaterial);scene.add(slabs);
  const aerialView={value:0};
  const floorMaterial=new THREE.MeshBasicMaterial({color:0x2b4362});
  floorMaterial.onBeforeCompile=shader=>{
    distantFog(shader);
    shader.uniforms.aerialView=aerialView;
    shader.uniforms.floorHighTint={value:new THREE.Color(0x233560)};
    shader.vertexShader='varying vec3 vGround;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 vGround; uniform vec3 floorHighTint; uniform float aerialView;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb=mix(diffuseColor.rgb,floorHighTint,smoothstep(12.,40.,cameraPosition.y));
      float wash=.92+.08*sin(vGround.x*.004+vGround.z*.003);
      vec2 cell=abs(fract(vGround.xz/24.+.5)-.5)*24.;
      vec2 aa=fwidth(vGround.xz)*1.2;
      float grid=1.-min(smoothstep(.10,.10+aa.x,cell.x),smoothstep(.10,.10+aa.y,cell.y));
      float outside=1.;
      ${MAZE_INSTANCES.map(m=>`{
        vec2 delta=vec2(vGround.x,-vGround.z)-vec2(${m.x.toFixed(6)},${m.s.toFixed(6)});
        vec2 site=vec2(${Math.cos(m.angle).toFixed(6)}*delta.x+${Math.sin(m.angle).toFixed(6)}*delta.y,${(-Math.sin(m.angle)).toFixed(6)}*delta.x+${Math.cos(m.angle).toFixed(6)}*delta.y);
        vec2 localMaze=vec2(${BASIS.d.toFixed(6)}*site.x-(${BASIS.b.toFixed(6)})*site.y,-(${BASIS.c.toFixed(6)})*site.x+${BASIS.a.toFixed(6)}*site.y)/${(BASIS.a*BASIS.d-BASIS.b*BASIS.c).toFixed(6)};
        outside*=max(step(${FLOOR_HALF[0].toFixed(1)},abs(localMaze.x)),step(${FLOOR_HALF[1].toFixed(1)},abs(localMaze.y)));
      }`).join('\n')}
      float grazing=1.-abs(normalize(cameraPosition-vGround).y);
      float visibility=mix(.55,1.,smoothstep(.2,.8,grazing))*mix(1.,.16,smoothstep(50.,140.,cameraPosition.y));
      visibility=mix(visibility,.85,aerialView);
      float gridFade=1.-smoothstep(mix(160.,1800.,aerialView),mix(650.,3000.,aerialView),length(cameraPosition-vGround));
      diffuseColor.rgb=mix(diffuseColor.rgb*wash*visibility,vec3(.65,.76,.95),grid*outside*mix(.95,.045,aerialView)*gridFade);`);
  };
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.06;scene.add(floor);
  return {floor,slabs,aerialView};
}
