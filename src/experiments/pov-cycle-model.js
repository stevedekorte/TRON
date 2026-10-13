// Carl N. Hoff's 54-primitive cycle, transcribed from Jason Cox's LightCycle.pov.
// Original source and MIT notice: docs/models/povray-lightcycle/.
// Source coordinates: forward +X, up +Y. No tessellation or mesh approximation.
import {Matrix4,Vector3} from 'three';
const union=(...children)=>({op:'union',children}), intersection=(...children)=>({op:'intersection',children}), difference=(...children)=>({op:'difference',children});
const leaf=(kind,data,transform=new Matrix4())=>({kind,data,transform});
const sphere=(center,radius,scale=[1,1,1],angle=0)=>leaf('sphere',[],new Matrix4().makeTranslation(...center).multiply(new Matrix4().makeRotationZ(angle*Math.PI/180)).multiply(new Matrix4().makeScale(...scale.map(x=>x*radius))));
const cylinder=(a,b,r1,r2=r1)=>{const z=new Vector3(...b).sub(new Vector3(...a)),length=z.length();z.normalize();const x=(Math.abs(z.y)>.99?new Vector3(1,0,0):new Vector3(0,1,0)).cross(z).normalize(),y=z.clone().cross(x);const transform=new Matrix4().makeBasis(x,y,z).setPosition(...a);return leaf('cone',[r1,r2,length],transform);};
const box=(a,b)=>leaf('box',[],new Matrix4().makeTranslation(...a.map((v,i)=>(v+b[i])/2)).multiply(new Matrix4().makeScale(...a.map((v,i)=>(b[i]-v)/2))));
const shear=object=>{const t=new Matrix4().set(1,0,0,0,-.57735,1,0,0,0,0,1,0,0,0,0,1);const visit=o=>{if(o.kind)o.transform.premultiply(t);else o.children.forEach(visit);};visit(object);return object;};
const plane=x=>leaf('plane',[x]);
// The source prism is swept along Y and then rotated -90 degrees about X.
// Its 2D coordinates therefore become X/Y, with the extrusion along Z.
const prism=(points,depth)=>leaf('prism',[points,depth]);
const torus=z=>leaf('torus',[367.221,11.5],new Matrix4().makeTranslation(192.447,-160,z));
const fenderCutout=()=>union(shear(union(cylinder([-86,165.823,0],[86,165.823,0],21),box([-86,0,-21],[86,165.823,21]))),cylinder([0,85,28],[0,85,-28],28.5));
const lower=union(intersection(union(cylinder([192.447,-160,26.5],[192.447,-160,-26.5],373.721),sphere([-12726.2,4308.38,0],270.336,[50,.575,1],-18.1527),shear(union(cylinder([-1,165.823,0],[86,165.823,0],26.5),box([-1,38.5,-26.5],[86,165.823,26.5])))),box([0,38.5,-60],[290,229.721,60])),difference(sphere([-16783.3,-2700.57,0],345.251,[50,.567439,1],9.30205),plane(148)),cylinder([293,85,0],[219,85,0],60,26.5));
const roof=radius=>union(cylinder([192.447,-160,17.5],[192.447,-160,-17.5],radius),cylinder([192.447,-160,-17.5],[192.447,-160,-22.5],radius,373.721+(radius-389.721)),cylinder([192.447,-160,17.5],[192.447,-160,22.5],radius,373.721+(radius-389.721)));
const windowShape=intersection(union(roof(389.722),sphere([238,145.4,0],77.5,[1.83,.75,1])),prism([[192.447,229.721],[238,145.4],[335.203,145.4],[445.105,229.721]],100));
const details=[cylinder([96.5,49.761,30],[96.5,49.761,-30],5)];
for(const z of [26.5,-26.5]){
 for(const [x,y] of [[218,105],[103,71.5],[47.1414,177.25]])details.push(sphere([x,y,z],11.5));
 for(const [a,b] of [[[320,166.5],[218,105]],[[218,105],[125,105]],[[125,105],[103,71.5]],[[103,71.5],[103,145]],[[103,145],[47.1414,177.25]]])details.push(cylinder([...a,z],[...b,z],11.5));
}
details.push(cylinder([47.1414,177.25,26.5],[47.1414,177.25,-26.5],11.5));
const upper=union(...details,intersection(roof(389.721),box([1,145.4,-23],[440,229.721,23])),intersection(union(cylinder([192.447,-160,-38],[192.447,-160,38],367.221),cylinder([192.447,-160,-26.5],[192.447,-160,26.5],378.721),torus(26.5),torus(-26.5)),prism([[285.005,145.4],[218,105],[125,105],[103,71.5],[103,145],[47.1414,177.25],[24.5339,229.721],[440,229.721],[440,145.4]],40)));
export const povCycleParts=[
 {name:'window',material:2,shape:windowShape},
 {name:'lower',material:3,shape:difference(lower,fenderCutout())},
 {name:'upper',material:1,shape:difference(upper,fenderCutout())},
 {name:'frontTire',material:1,shape:difference(sphere([355,85,0],85),sphere([355,85,57.1615],57.0742),sphere([355,85,-57.1615],57.0742))},
 {name:'frontAxle',material:3,shape:union(sphere([355,85,-29],17),sphere([355,85,29],17))},
 {name:'frontHub',material:2,shape:cylinder([355,85,30],[355,85,-30],60)},
 {name:'rearTire',material:1,shape:difference(sphere([0,85,0],85,[1,1,.2]),sphere([0,85,20.8732],58.7155),sphere([0,85,-20.8732],58.7155))},
 {name:'rearAxle',material:3,shape:sphere([0,85,0],17)},
 {name:'rearHub',material:2,shape:cylinder([0,85,1],[0,85,-1],60)},
];
export const POV_CYCLE_SCALE=3.6/525;
const number=n=>Number(n).toFixed(9),vec=v=>`vec${v.length}(${v.map(number).join(',')})`;
export function compilePovCycle(){
 const functions=povCycleParts.map(part=>{
  const leaves=[];
  const expression=node=>{if(node.kind){const i=leaves.push(node)-1;return `(bits & (1u << ${i}u)) != 0u`;}const c=node.children.map(n=>`(${expression(n)})`);return node.op==='union'?c.join(' || '):node.op==='intersection'?c.join(' && '):`${c[0]} && !(${c.slice(1).join(' || ')})`;};
  const expr=expression(part.shape);if(leaves.length>32)throw Error('CSG mask capacity exceeded');
  const calls=leaves.map((l,i)=>{
   const inv=l.transform.clone().invert(),m=`mat4(${inv.elements.map(number).join(',')})`;
   let call;
   if(l.kind==='prism'){
    const [points,depth]=l.data;
    call=`vec2 poly[9];${points.map((p,j)=>`poly[${j}]=${vec(p)};`).join('')} prismEvents(o,d,${points.length},poly,${number(depth)},${i}u,normalMatrix);`;
   }else call=`${l.kind}Events(o,d,${l.data.map(number).map(n=>n+',').join('')}${i}u,normalMatrix);`;
   return `{mat4 inv=${m};vec3 o=(inv*vec4(ro,1)).xyz,d=(inv*vec4(rd,0)).xyz;mat3 normalMatrix=transpose(mat3(inv));${call}}`;
  }).join('\n');
  // Only the rear prism cut on the projecting side window is a gray return.
  // Keep the roof strip / top lip and curved glazing black. Material 4 shares
  // the underbody pigment, with a little reflected fill on this downward face.
  const material=part.name==='window'?`(e.id==${leaves.findIndex(l=>l.kind==='prism')}u && n.x<-.5 && abs((ro+rd*e.t).z)>23.001 ? 4 : 2)`:part.material;
  return `bool inside_${part.name}(uint bits){return ${expr};}\nvoid hit_${part.name}(vec3 ro,vec3 rd,inout Hit hit){eventCount=0;bits=0u;${calls}\n sortEvents();bool was=inside_${part.name}(bits);for(int i=0;i<80;i++){if(i>=eventCount)break;Event e=events[i];bits^=1u<<e.id;bool now=inside_${part.name}(bits);if(was!=now){vec3 n=e.n;if((dot(n,rd)<0.)!=now)n=-n;if(e.t<hit.t${part.name==='window'?' || (hit.material==1 && e.t<hit.t+.03)':''})hit=Hit(e.t,n,${material});return;}was=now;}}`;
 }).join('\n');
 return functions+`\nHit cycleHit(vec3 origin,vec3 direction){float scale=${number(POV_CYCLE_SCALE)};vec3 ro=vec3(177.5-origin.z/scale,origin.y/scale,origin.x/scale),rd=vec3(-direction.z,direction.y,direction.x);vec3 low=vec3(-85.1,-.1,-80.),high=vec3(440.1,230.,80.);vec3 inv=1./rd,a=(low-ro)*inv,b=(high-ro)*inv;vec3 nearV=min(a,b),farV=max(a,b);rangeStart=max(.0005/scale,max(nearV.x,max(nearV.y,nearV.z)));rangeEnd=min(farV.x,min(farV.y,farV.z));Hit h=emptyHit();h.t=100000.;if(rangeStart>=rangeEnd)return emptyHit();${[...povCycleParts].sort((a,b)=>(a.name==='upper'?-1:b.name==='upper'?1:0)).map(p=>`hit_${p.name}(ro,rd,h);rangeEnd=min(rangeEnd,h.t+.03);`).join('')}if(h.material==0)return emptyHit();h.t*=scale;h.n=normalize(vec3(h.n.z,h.n.y,-h.n.x));return h;}`;
}
