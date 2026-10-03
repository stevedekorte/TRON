import * as T from 'three';

// Y-up, front -Z. Width/height/depth follow the accepted two-view silhouette.
export const PLANAR_SHUTTLE=Object.freeze({width:20,height:7.2,depth:10.6,wall:.35,cornerRadius:1.65,cornerSegments:32,slotWidth:2.4,slotStartZ:.1});
export function createPlanarShuttle(){
 const c=PLANAR_SHUTTLE,w=c.width/2,h=c.height/2,front=-c.depth/2,rear=c.depth/2,r=c.cornerRadius;
 const root=new T.Group();root.name='Planar carrier escape shuttle';root.position.y=4;
 const gray=new T.MeshStandardMaterial({color:0x89949e,roughness:.85,metalness:.04});
 const pale=new T.MeshStandardMaterial({color:0xc2cbd2,roughness:.9});
 const inset=new T.MeshStandardMaterial({color:0x394d48,roughness:.72});
 const green=new T.MeshStandardMaterial({color:0x368548,emissive:0x103b17,emissiveIntensity:.5,roughness:.8});
 function add(name,geometry,material=gray){const mesh=new T.Mesh(geometry,material);mesh.name=name;root.add(mesh);return mesh;}
 function box(name,x,y,z,sx,sy,sz,material=gray){const m=add(name,new T.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);return m;}
 // A planar top/bottom outline with a rear center notch. Only the front
 // corners follow an arc; no bevels or global smoothing affect the panels.
 const outline=new T.Shape();
 outline.moveTo(-w,rear);outline.lineTo(-w,front+r);
 outline.absarc(-w+r,front+r,r,Math.PI,Math.PI*1.5,false);
 outline.lineTo(w-r,front);outline.absarc(w-r,front+r,r,-Math.PI/2,0,false);
 outline.lineTo(w,rear);outline.lineTo(c.slotWidth/2,rear);outline.lineTo(c.slotWidth/2,c.slotStartZ);
 outline.lineTo(-c.slotWidth/2,c.slotStartZ);outline.lineTo(-c.slotWidth/2,rear);outline.closePath();
 for(const sy of [-1,1]){
  const g=new T.ExtrudeGeometry(outline,{depth:c.wall,bevelEnabled:false,curveSegments:c.cornerSegments});
  // Shape XY maps into model XZ; extrusion points inward from each face.
  g.rotateX(Math.PI/2);g.translate(0,h,0);
  if(sy<0){g.scale(1,-1,1);const idx=g.index;if(idx){for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,a);}}else{
   for(const attr of Object.values(g.attributes))for(let i=0;i<attr.count;i+=3)for(let k=0;k<attr.itemSize;k++){
    const a=attr.array[i*attr.itemSize+k];attr.array[i*attr.itemSize+k]=attr.array[(i+2)*attr.itemSize+k];attr.array[(i+2)*attr.itemSize+k]=a;
   }
  }}
  add(sy>0?'Flat upper deck':'Flat lower deck',g);
 }
 const frame=w-r;
 box('Recessed front panel',0,0,front+.22,frame*2,4.9,.12,inset);
 for(const sy of [-1,1]){
  box('Front frame horizontal',0,sy*(h-.4),front+.18,frame*2,.8,c.wall);
  box('Green inset horizontal',0,sy*2.46,front+.13,frame*2-.45,.065,.04,green);
 }
 for(const sx of [-1,1]){
  box('Front frame upright',sx*(frame-.22),0,front+.18,.44,h*2,c.wall);
  box('Green inset upright',sx*(frame-.46),0,front+.13,.065,4.92,.04,green);
  box('Flat side return',sx*(w-c.wall/2),0,(front+r+rear)/2,c.wall,h*2,rear-front-r);
  // Smooth normals are confined to quarter cylinders about the vertical axis.
  const positions=[],normals=[],indices=[];
  for(let i=0;i<=c.cornerSegments;i++){
   const angle=i/c.cornerSegments*Math.PI/2;
   const nx=sx*Math.sin(angle),nz=-Math.cos(angle),x=sx*(w-r)+nx*r,z=front+r+nz*r;
   positions.push(x,-h,z,x,h,z);normals.push(nx,0,nz,nx,0,nz);
   if(i<c.cornerSegments){const a=i*2;const tri=[a,a+1,a+2,a+2,a+1,a+3];if(sx<0)for(let j=0;j<6;j+=3)[tri[j],tri[j+2]]=[tri[j+2],tri[j]];indices.push(...tri);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(indices);
  const curved=add('Quarter-circle front corner',g);curved.material=gray.clone();curved.material.side=T.DoubleSide;
  // Straight shallow details, paired across both symmetry planes.
  for(const sy of [-1,1])for(let i=0;i<3;i++)box('Straight deck rib',sx*5.5,sy*(h+.055),rear-1-i*.7,5,.11,.28,pale);
  for(const sy of [-1,1])box('Straight side band',sx*(w+.035),sy*(h-.9),2,.07,.16,3.7,pale);
 }
 root.userData={source:'Reconstruction of user-accepted Meshy two-view silhouette and supplied TRON film references',construction:'Flat panels; quarter-circle front corners only; X/Y reflection symmetry',dimensions:c};
 return root;
}
