// Converts the POV-Ray light cycle (src/experiments/pov-cycle-model.js, the exact
// CSG drawn by the POV-Ray renderer) into an ordinary triangle mesh (GLB) for the
// normal renderer.
//
// Each primitive is tessellated adaptively to a chord tolerance measured in its
// final (transformed, sheared) shape, finer inside the cycle's bounds and coarse
// where booleans discard it. Exact mesh booleans (manifold-3d) then cut every
// intersection curve from those surfaces, so parts meet along shared edges with
// no gaps. Vertex normals come from each primitive's analytic surface (smooth
// curves); planar faces and every intersection crease stay sharp.
//
//   node tools/assets/pov-cycle-mesh.mjs [--tolerance 0.25] [--out assets/runtime/models/pov_light_cycle.glb]
// Tolerance is in POV source units (1 unit = 3.6/525 m ≈ 6.9 mm).
import Module from 'manifold-3d';
import {Matrix4,Matrix3,Vector3,Color} from 'three';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {povCycleParts,POV_CYCLE_SCALE} from '../../src/experiments/pov-cycle-model.js';

export const POV_CYCLE_MESH=Object.freeze({
 toleranceUnits:.15,          // chord tolerance inside the cycle's bounds (~1 mm; 24k triangles, under the 28k of the model it replaces)
 outsideToleranceUnits:20,    // where every boolean discards the surface
 bounds:{min:[-90,-5,-85],max:[445,235,85]}, // source units, a little beyond the cycle
 maxSegments:768, maxDepth:14,
 materials:Object.freeze([ // POV material number -> glTF material (names are the roles the renderer already knows)
  null,
  {name:'Color_D06',color:new Color('#e6bd14').toArray(),metallic:0,roughness:.45}, // 1 team paint (body, tyres); POV-Ray gold, linear
  {name:'black',color:[.008,.011,.018],metallic:0,roughness:.15},        // 2 glass, hubs
  {name:'_LightGray_1',color:[.32,.38,.48],metallic:0,roughness:.5},     // 3 underbody
  {name:'WindowReturn',color:[.32,.38,.48],metallic:0,roughness:.5},     // 4 grey return inside the side window
 ]),
});

const args=new Map(process.argv.slice(2).reduce((pairs,a,i,all)=>a.startsWith('--')?[...pairs,[a.slice(2),all[i+1]]]:pairs,[]));
const tolerance=Number(args.get('tolerance')??POV_CYCLE_MESH.toleranceUnits);
const out=args.get('out')??'assets/runtime/models/pov_light_cycle.glb';

const wasm=await Module();wasm.setup();
const {Manifold,CrossSection,Mesh}=wasm;
const B=POV_CYCLE_MESH.bounds;
const inBounds=p=>p.x>=B.min[0]&&p.x<=B.max[0]&&p.y>=B.min[1]&&p.y<=B.max[1]&&p.z>=B.min[2]&&p.z<=B.max[2];
const tolAt=(a,b)=>inBounds(a)||inBounds(b)||inBounds(a.clone().add(b).multiplyScalar(.5))?tolerance:POV_CYCLE_MESH.outsideToleranceUnits;
const sag=(f,a,b)=>{const pa=f(a),pb=f(b),pm=f((a+b)/2);return {error:pm.distanceTo(pa.clone().add(pb).multiplyScalar(.5)),tol:tolAt(pa,pb)};};

// Adaptive 1D sampling of a parameter interval: every curve fs(t) in the family must
// stay within tolerance of its chords.
function samples(lo,hi,family,depth=0){
 const mid=(lo+hi)/2;
 const split=depth<POV_CYCLE_MESH.maxDepth&&family.some(f=>{const s=sag(f,lo,hi),q1=sag(f,lo,mid),q2=sag(f,mid,hi);return s.error>s.tol||q1.error>q1.tol||q2.error>q2.tol;});
 return split?[...samples(lo,mid,family,depth+1),...samples(mid,hi,family,depth+1).slice(1)]:[lo,hi];
}
// Smallest power-of-two-ish ring count whose chords all meet tolerance.
function ringCount(rings){
 for(let n=16;;n=Math.min(POV_CYCLE_MESH.maxSegments,Math.ceil(n*1.25))){
  const ok=rings.every(f=>{for(let i=0;i<n;i++){const s=sag(f,i/n*2*Math.PI,(i+1)/n*2*Math.PI);if(s.error>s.tol)return false;}return true;});
  if(ok||n>=POV_CYCLE_MESH.maxSegments)return n;
 }
}
const toManifold=(positions,triangles,matrix)=>{
 if(matrix&&matrix.determinant()<0)for(const t of triangles)[t[1],t[2]]=[t[2],t[1]];
 const vertProperties=new Float32Array(positions.length*3),triVerts=new Uint32Array(triangles.length*3);
 positions.forEach((p,i)=>vertProperties.set([p.x,p.y,p.z],i*3));triangles.forEach((t,i)=>triVerts.set(t,i*3));
 return new Manifold(new Mesh({numProp:3,vertProperties,triVerts}));
};

// Unit sphere about the local axis with the longest transformed extent, so the
// narrow tips of the stretched ellipsoids get the finest latitude spacing.
function sphereManifold(m){
 const axes=[0,1,2].map(i=>new Vector3().setFromMatrixColumn(m,i).length());const pole=axes.indexOf(Math.max(...axes));
 const P=new Vector3().setComponent(pole,1),E1=new Vector3().setComponent((pole+1)%3,1),E2=new Vector3().setComponent((pole+2)%3,1);
 const at=(phi,theta)=>P.clone().multiplyScalar(Math.cos(phi)).addScaledVector(E1,Math.sin(phi)*Math.cos(theta)).addScaledVector(E2,Math.sin(phi)*Math.sin(theta)).applyMatrix4(m);
 const probe=[0,1,2,3,4,5,6,7].map(k=>k/8*2*Math.PI);
 const phis=samples(0,Math.PI,probe.map(th=>phi=>at(phi,th)));
 const n=ringCount(phis.slice(1,-1).map(phi=>th=>at(phi,th)));
 const positions=[at(0,0)],triangles=[];
 for(const phi of phis.slice(1,-1))for(let i=0;i<n;i++)positions.push(at(phi,i/n*2*Math.PI));
 const south=positions.push(at(Math.PI,0))-1,rings=phis.length-2,ring=(r,i)=>1+r*n+(i%n);
 for(let i=0;i<n;i++)triangles.push([0,ring(0,i),ring(0,i+1)]);
 for(let r=0;r<rings-1;r++)for(let i=0;i<n;i++){triangles.push([ring(r,i),ring(r+1,i),ring(r+1,i+1)]);triangles.push([ring(r,i),ring(r+1,i+1),ring(r,i+1)]);}
 for(let i=0;i<n;i++)triangles.push([south,ring(rings-1,i+1),ring(rings-1,i)]);
 return fixOrientation(toManifold(positions,triangles,m));
}
// Cone/cylinder: local z in [0,len], radius r0 -> r1 (straight sides need only end rings).
function coneManifold([r0,r1,len],m){
 const at=(z,r,th)=>new Vector3(r*Math.cos(th),r*Math.sin(th),z).applyMatrix4(m);
 const n=ringCount([th=>at(0,r0,th),th=>at(len,r1,th)]);
 const positions=[at(0,0,0),at(len,0,0)],triangles=[];
 for(const [z,r] of [[0,r0],[len,r1]])for(let i=0;i<n;i++)positions.push(at(z,r,i/n*2*Math.PI));
 const a=i=>2+(i%n),b=i=>2+n+(i%n);
 for(let i=0;i<n;i++){triangles.push([0,a(i+1),a(i)],[1,b(i),b(i+1)],[a(i),a(i+1),b(i+1)],[a(i),b(i+1),b(i)]);}
 return fixOrientation(toManifold(positions,triangles,m));
}
// Torus about local Z: major radius in XY, tube radius around it.
function torusManifold([major,minor],m){
 const at=(u,v)=>new Vector3((major+minor*Math.cos(v))*Math.cos(u),(major+minor*Math.cos(v))*Math.sin(u),minor*Math.sin(v)).applyMatrix4(m);
 const nu=ringCount([u=>at(u,0),u=>at(u,Math.PI/2)]),nv=ringCount([v=>at(0,v)]);
 const positions=[],triangles=[],id=(i,j)=>(i%nu)*nv+(j%nv);
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++)positions.push(at(i/nu*2*Math.PI,j/nv*2*Math.PI));
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++)triangles.push([id(i,j),id(i+1,j),id(i+1,j+1)],[id(i,j),id(i+1,j+1),id(i,j+1)]);
 return fixOrientation(toManifold(positions,triangles,m));
}
const boxManifold=m=>Manifold.cube([2,2,2],true).transform(m.elements);
const planeManifold=([x])=>Manifold.cube([x+1e6,2e6,2e6],false).translate([-1e6,-1e6,-1e6]); // half-space x < X (the stretched ellipsoids reach x ≈ -34000)
function prismManifold([points,depth],m){
 const section=new CrossSection([points.map(p=>[p[0],p[1]])],'NonZero');
 return Manifold.extrude(section,2*depth).translate([0,0,-depth]).transform(m.elements);
}
// A closed surface built with either winding: make it enclose positive volume.
const fixOrientation=manifold=>{if(manifold.volume()>=0)return manifold;const mesh=manifold.getMesh();const t=mesh.triVerts;for(let i=0;i<t.length;i+=3)[t[i+1],t[i+2]]=[t[i+2],t[i+1]];return new Manifold(mesh);};

// Leaves keep their originalID so output triangles can find their primitive.
const leaves=new Map();
function build(node){
 if(node.kind){
  const m=node.transform,manifold=(node.kind==='sphere'?sphereManifold(m):node.kind==='cone'?coneManifold(node.data,m):node.kind==='torus'?torusManifold(node.data,m):node.kind==='box'?boxManifold(m):node.kind==='plane'?planeManifold(node.data):prismManifold(node.data,m)).asOriginal();
  if(manifold.status&&manifold.status()!=='NoError')throw Error(`${node.kind}: ${manifold.status()}`);
  leaves.set(manifold.originalID(),{...node,inverse:m.clone().invert(),normalMatrix:new Matrix3().getNormalMatrix(m)});
  return manifold;
 }
 const c=node.children.map(build);
 return node.op==='union'?Manifold.union(c):node.op==='intersection'?Manifold.intersection(c):Manifold.difference(c[0],Manifold.union(c.slice(1)));
}

// Analytic outward-or-inward gradient at a source-space point (null: use the flat face normal).
function gradient(leaf,p,faceNormal){
 const l=p.clone().applyMatrix4(leaf.inverse);let g;
 if(leaf.kind==='sphere')g=l;
 else if(leaf.kind==='torus'){const [major]=leaf.data,rho=Math.hypot(l.x,l.y)||1;g=new Vector3(l.x*(1-major/rho),l.y*(1-major/rho),l.z);}
 else if(leaf.kind==='cone'){
  const [r0,r1,len]=leaf.data,k=(r1-r0)/len,axis=new Vector3(0,0,1).applyMatrix3(leaf.normalMatrix).normalize();
  if(Math.abs(faceNormal.dot(axis))>.99)return null; // end cap
  g=new Vector3(l.x,l.y,-k*(r0+k*l.z));
 }else return null;
 return g.applyMatrix3(leaf.normalMatrix).normalize();
}

const toGame=(x,y,z)=>[z*POV_CYCLE_SCALE,y*POV_CYCLE_SCALE,(177.5-x)*POV_CYCLE_SCALE];
const toGameDir=(x,y,z)=>[z,y,-x];
const primitives=new Map(); // material -> {positions,normals,indices}
const report=[];
// Parts overlap (the glass is a 389.722-unit roof over the 389.721-unit paint; hubs sit
// inside tyres). Overlapping volume is never visible, but two coincident surfaces from
// separately tessellated parts z-fight. Each part therefore drops what earlier parts
// already fill, the window first, as its slightly larger surface wins in POV-Ray.
let claimed=null;
for(const part of povCycleParts){
 const own=build(part.shape),solid=claimed?Manifold.difference(own,claimed):own;
 claimed=claimed?Manifold.union(claimed,own):own;
 const mesh=solid.getMesh();
 const v=mesh.vertProperties,t=mesh.triVerts,np=mesh.numProp;
 const P=i=>new Vector3(v[i*np],v[i*np+1],v[i*np+2]);
 let flatTris=0;
 for(let run=0;run<mesh.runOriginalID.length;run++){
  const leaf=leaves.get(mesh.runOriginalID[run]);
  for(let k=mesh.runIndex[run];k<mesh.runIndex[run+1];k+=3){
   const ids=[t[k],t[k+1],t[k+2]],ps=ids.map(P);
   const face=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0]));if(face.lengthSq()<1e-18)continue;face.normalize();
   let material=part.material;
   if(part.name==='window'&&leaf.kind==='prism'&&face.x<-.5&&Math.abs((ps[0].z+ps[1].z+ps[2].z)/3)>23.001)material=4;
   const target=primitives.get(material)??primitives.set(material,{positions:[],normals:[],indices:[],lookup:new Map()}).get(material);
   const corner=ids.map((id,c)=>{
    let n=gradient(leaf,ps[c],face);const smooth=!!n;if(!n){n=face;flatTris++;}
    if(n.dot(face)<0)n=n.clone().negate();
    // Vertices are shared only within one smooth primitive surface (or one flat face plane).
    const key=`${id}|${mesh.runOriginalID[run]}|${smooth?'s':face.toArray().map(x=>x.toFixed(4)).join(',')}`;
    let index=target.lookup.get(key);
    if(index===undefined){index=target.positions.length/3;target.lookup.set(key,index);target.positions.push(...toGame(ps[c].x,ps[c].y,ps[c].z));target.normals.push(...toGameDir(n.x,n.y,n.z));}
    return index;
   });
   target.indices.push(...corner);
  }
 }
 report.push({part:part.name,triangles:t.length/3,genus:solid.genus(),volume:+solid.volume().toFixed(0)});
}

// Minimal GLB writer: one mesh node per material, float32 positions/normals, uint32 indices.
function glb(prims){
 const chunks=[],accessors=[],views=[],meshes=[],nodes=[],materials=[];let offset=0;
 const add=(array,target)=>{const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const pad=(4-bytes.length%4)%4;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});chunks.push(bytes,Buffer.alloc(pad));offset+=bytes.length+pad;return views.length-1;};
 for(const [material,p] of [...prims].sort((a,b)=>a[0]-b[0])){
  const positions=new Float32Array(p.positions),normals=new Float32Array(p.normals),indices=new Uint32Array(p.indices);
  const min=[0,1,2].map(i=>Math.min(...positions.filter((_,j)=>j%3===i))),max=[0,1,2].map(i=>Math.max(...positions.filter((_,j)=>j%3===i)));
  accessors.push({bufferView:add(positions,34962),componentType:5126,count:positions.length/3,type:'VEC3',min,max});
  accessors.push({bufferView:add(normals,34962),componentType:5126,count:normals.length/3,type:'VEC3'});
  accessors.push({bufferView:add(indices,34963),componentType:5125,count:indices.length,type:'SCALAR'});
  const def=POV_CYCLE_MESH.materials[material];
  materials.push({name:def.name,pbrMetallicRoughness:{baseColorFactor:[...def.color,1],metallicFactor:def.metallic,roughnessFactor:def.roughness}});
  meshes.push({name:`POV cycle ${def.name}`,primitives:[{attributes:{POSITION:accessors.length-3,NORMAL:accessors.length-2},indices:accessors.length-1,material:materials.length-1}]});
  nodes.push({name:`POV cycle ${def.name}`,mesh:meshes.length-1});
 }
 const json={asset:{version:'2.0',generator:'tools/assets/pov-cycle-mesh.mjs (manifold-3d booleans of the POV-Ray light cycle CSG)'},
  scene:0,scenes:[{name:'POV-Ray light cycle mesh',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,accessors,bufferViews:views,buffers:[{byteLength:offset}],
  extras:{source:'src/experiments/pov-cycle-model.js',toleranceUnits:tolerance,scaleMetersPerUnit:POV_CYCLE_SCALE}};
 let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
 const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+text.length+8+bin.length,8);
 jh.writeUInt32LE(text.length,0);jh.write('JSON',4);bh.writeUInt32LE(bin.length,0);bh.write('BIN\0',4);
 return Buffer.concat([header,jh,text,bh,bin]);
}
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,glb(primitives));
const triangles=[...primitives.values()].reduce((n,p)=>n+p.indices.length/3,0),vertices=[...primitives.values()].reduce((n,p)=>n+p.positions.length/3,0);
console.log(JSON.stringify({out,toleranceUnits:tolerance,triangles,vertices,parts:report},null,1));
