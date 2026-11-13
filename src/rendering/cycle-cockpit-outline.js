import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {CYCLE_WHEEL_INTERIORS} from './cycle-surface.js';

// First-person cycle view fades out the rider's own cycle. A sparse glowing
// outline of its canopy and window frames keeps a sense of the vehicle without
// blocking the view. Lines are the open boundaries (rims of openings and panel
// edges) of the canopy materials, never every triangle; wheel rims are omitted.
export const CYCLE_COCKPIT_OUTLINE=Object.freeze({
 opacity:.5,           // at full first-person fade
 brightness:1.6,       // multiplier on the team body color (HDR glow)
 materials:Object.freeze(['black','Color_L12']), // canopy glass frames and roof spine
 wheel:Object.freeze({centerY:CYCLE_WHEEL_INTERIORS.centerY,centersZ:Object.freeze([CYCLE_WHEEL_INTERIORS.frontZ,CYCLE_WHEEL_INTERIORS.rearZ]),radius:.275}), // model units
});

// The rest of the rider's cycle stays as a faint shell in its outside colors.
export const CYCLE_COCKPIT_BODY=Object.freeze({
 opacity:.2,                               // body opacity at full first-person fade
 windowMaterials:Object.freeze(['black']), // canopy glass: fades out completely
});

/** Edges used by exactly one triangle after welding coincident vertices. */
export function boundaryEdges(source){
 const plain=new THREE.BufferGeometry();plain.setAttribute('position',source.attributes.position);if(source.index)plain.setIndex(source.index);
 const welded=mergeVertices(plain,1e-5),index=welded.index.array,pos=welded.attributes.position,uses=new Map(),stride=pos.count+1;
 for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){
  const i=index[t+k],j=index[t+(k+1)%3],key=i<j?i*stride+j:j*stride+i;uses.set(key,(uses.get(key)??0)+1);
 }
 const out=[];
 for(const [key,count] of uses)if(count===1){const i=Math.floor(key/stride),j=key%stride;out.push(pos.getX(i),pos.getY(i),pos.getZ(i),pos.getX(j),pos.getY(j),pos.getZ(j));}
 welded.dispose();
 return out;
}
const inWheel=(p,{wheel})=>!!wheel&&wheel.centersZ.some(z=>Math.hypot(p.y-wheel.centerY,p.z-z)<wheel.radius);
/** Outline segments of the cycle model `root`, in its own local space. */
export function cycleOutlineGeometry(root,options=CYCLE_COCKPIT_OUTLINE){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),relative=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3(),positions=[];
 root.traverse(o=>{
  if(!o.isMesh||![].concat(o.material).some(m=>options.materials.includes(m.name)))return;
  relative.multiplyMatrices(inverse,o.matrixWorld);
  const edges=boundaryEdges(o.geometry);
  for(let i=0;i<edges.length;i+=6){
   a.fromArray(edges,i).applyMatrix4(relative);b.fromArray(edges,i+3).applyMatrix4(relative);
   if(!(inWheel(a,options)&&inWheel(b,options)))positions.push(a.x,a.y,a.z,b.x,b.y,b.z);
  }
 });
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 return geometry;
}

export class CycleCockpitOutline{
 constructor(model,options=CYCLE_COCKPIT_OUTLINE){
  this.options=options;
  this.material=new THREE.LineBasicMaterial({transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false});
  this.lines=new THREE.LineSegments(cycleOutlineGeometry(model,options),this.material);
  this.lines.name='Cycle cockpit outline';this.lines.visible=false;this.lines.frustumCulled=false;this.lines.renderOrder=2;
 }
 get segmentCount(){return this.lines.geometry.attributes.position.count/2;}
 /** Follows `bike` while its body is faded out by `mix` (0 = solid body, 1 = hidden). */
 update(bike,mix,color){
  if(!bike||!(mix>0)){this.lines.visible=false;return;}
  if(this.lines.parent!==bike.parent)bike.parent?.add(this.lines);
  this.lines.position.copy(bike.position);this.lines.quaternion.copy(bike.quaternion);this.lines.scale.copy(bike.scale);
  this.material.opacity=this.options.opacity*Math.min(1,mix);
  if(color)this.material.color.copy(color).multiplyScalar(this.options.brightness);
  this.lines.visible=true;
 }
 dispose(){this.lines.removeFromParent();this.lines.geometry.dispose();this.material.dispose();}
}
