import * as T from 'three';

// Open shell reconstruction. Y up; size and travel direction remain provisional.
export const SHUTTLE={width:20,length:14,height:9};
export function createCarrierShuttle(){
 const root=new T.Group();root.name='Carrier escape shuttle';
 const mat=(name,color)=>new T.MeshStandardMaterial({name,color,roughness:.9,metalness:.04,flatShading:true,side:T.DoubleSide});
 const hull=mat('Gray shell',0x8d969f),inside=mat('Inner shell',0x7f8998),dark=mat('Recess faces',0x34434b),ivory=mat('Pale ribs',0xc5ced0),glass=mat('Olive inset',0x4d6152);
 const green=new T.MeshStandardMaterial({name:'Subdued green frame',color:0x25753b,emissive:0x13702b,emissiveIntensity:.25,roughness:.8});
 function add(name,geometry,material,parent=root){const m=new T.Mesh(geometry,material);m.name=name;parent.add(m);return m;}
 function box(name,w,h,d,x,y,z,material=hull){const m=add(name,new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m;}
 function plate(name,points,thickness,y,material){
  const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);return add(name,g,material);
 }
 // The detachment still exposes two thin ribbed trays, not solid rectangular
 // nacelles. The center notch is genuinely open through the bottom.
 for(const side of [-1,1]){
  const p=[[1.15,-8.7],[2.5,-10],[6.25,-10],[7,-9.2],[7,9.2],[6.25,10],[2.5,10],[1.15,8.7]].map(([x,z])=>[side*x,z]);
  plate('Ribbed shell tray',p,.75,0,hull);
  // Broad tall back blades terminate the trays; the other end stays open.
  const shape=new T.Shape([new T.Vector2(1.15,.7),new T.Vector2(7,.7),new T.Vector2(7,7.8),new T.Vector2(6.15,9),new T.Vector2(1.15,9)]);
  const wall=new T.ExtrudeGeometry(shape,{depth:.8,bevelEnabled:false});wall.translate(0,0,9.1);if(side<0)wall.scale(-1,1,1);
  add('Upright back blade',wall,hull);
  // Detachment exposes one tray: only one edge has the tall side wall.
  if(side<0){
  // Narrow outer spine, with an actual rectangular aperture between sill/header.
  const x=side*6.65;
  box('Outer lower sill',.7,2.1,18.2,x,1.8,0);
  box('Outer upper rail',.7,1.15,18.2,x,8.325,0);
  box('Rear side cheek',.7,4.9,5.5,x,5.3,6.3);
  box('Forward side cheek',.7,4.9,5.5,x,5.3,-6.3);
  // Recessed green window, rather than a colored rectangle pasted on a solid block.
  const windowX=side*6.48;
  box('Olive recessed side inset',.08,4.9,7.15,windowX,5.3,0,glass);
  for(const z of [-3.575,3.575])box('Green side upright',.08,4.9,.07,side*6.57,5.3,z,green);
  for(const y of [2.85,7.75])box('Green side sill',.08,.07,7.15,side*6.57,y,0,green);
  box('Inset horizontal seam',.09,.08,7.15,side*6.58,4.65,0,dark);
  }
  for(const end of [-1,1])for(let j=0;j<3;j++){
   box('Tray rib',4.1,.17,.35,side*4.05,.835,end*(6.9+j*.65),ivory);
  }
  // The pale bands belong on the outer face of the standing blade.
  for(const y of [1.05,7.8])box('Back blade strip',4.1,.18,.06,side*4.05,y,9.93,ivory);
 }
 // Thin recessed saddle links the trays only at their middle; no solid infill.
 box('Connecting saddle',2.3,.65,9.4,0,.7,0,inside);
 // Thin raised ledges bound the dark longitudinal slot, visible in overhead shots.
 for(const side of [-1,1])box('Center slot ledge',.22,.22,13.4,side*1.2,1.01,0,dark);
 // The ribbed surface is overhead: the shell opens downward, viewed from below.
 root.scale.set(20/14,-1,14/20);root.position.y=SHUTTLE.height;
 root.userData={source:'TRON (1982): supplied Escapepoddetach/side/top/back stills and MCP destroyed.mp4 2:34–2:57',provisional:'Open asymmetric shell interpretation; scale and internal saddle inferred',dimensions:SHUTTLE};
 return root;
}
