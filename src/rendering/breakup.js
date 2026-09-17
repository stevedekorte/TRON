import * as THREE from 'three';
import {wallIntersection} from '../levels/maze.js';
import {createBlast} from './blast.js';

// Seconds and meters/second²; keep ground-tank destruction at its existing pace.
const BREAKUP_MOTION={
 recognizer:{impulseScale:5,spinScale:2.2,lift:1,liftVariation:2,delay:.04,flash:.1,gravity:14.7,life:5,lifeVariation:1,fade:1},
 tank:{impulseScale:1,spinScale:1,lift:3,liftVariation:5,delay:.12,flash:.22,gravity:9.81,life:10,lifeVariation:2,fade:2},
};

// Recognizers detach as intact blocks; tanks retain their fractured impact effect.
// Preserve posed surfaces and trim, with fresh impulses for each explosion.
export class Breakups {
 constructor(scene){this.scene=scene;this.bursts=[];}
 spawn(craft,event){
  const motion=BREAKUP_MOTION[['tank','enemyTank'].includes(event.subject)?'tank':'recognizer'];
  const fracture=motion===BREAKUP_MOTION.tank;
  if(this.bursts.length>=5)this.remove(this.bursts[0]);
  craft.root.position.set(event.x,event.y,-event.s);craft.root.rotation.y=event.yaw;
  craft.pose?.(event.fold);craft.root.updateMatrixWorld(true);
  const surfaces=[],centers=[];
  const impact=new THREE.Vector3(event.hit?.x??event.x,event.hit?.y??event.y,event.hit?.z??-event.s);
  let hitPart='body',nearestDistance=Infinity;
  const triangle=new THREE.Triangle(),closest=new THREE.Vector3();
  craft.root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData.breakupExclude)return;
   let part=['tank','enemyTank'].includes(event.subject)?'tank':'body';
   for(let parent=mesh.parent;parent&&parent!==craft.root;parent=parent.parent){
    if(parent.name==='left-leg'||parent.name==='right-leg'){part=parent.name;break;}
   }
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrixWorld);
   const position=geometry.attributes.position,sections=new Map();
   const local=mesh.geometry.attributes.position;
   for(let i=0;i<position.count;i+=3){
    const center=new THREE.Vector3();
    for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(position,i+j));
    center.multiplyScalar(1/3);
    // The rig's "body" includes the crown, crossbar and both shoulder blocks.
    // Keep these separate so a crown hit cannot also shred both shoulders.
    let section=part;
    if(part==='body'){
     let lx=0,ly=0;
     for(let j=0;j<3;j++){const k=mesh.geometry.index?.getX(i+j)??i+j;lx+=local.getX(k)/3;ly+=local.getY(k)/3;}
     section=Math.abs(lx)>9?(lx<0?'left-shoulder':'right-shoulder'):(ly>1?'crown':'crossbar');
    }
    if(!sections.has(section))sections.set(section,[]);
    sections.get(section).push({i,center});centers.push({center,part:section});
    triangle.a.fromBufferAttribute(position,i);triangle.b.fromBufferAttribute(position,i+1);triangle.c.fromBufferAttribute(position,i+2);
    triangle.closestPointToPoint(impact,closest);
    const distance=closest.distanceToSquared(impact);
    if(distance<nearestDistance){nearestDistance=distance;hitPart=section;}
   }
   for(const [section,triangles] of sections)surfaces.push({geometry,triangles,material:mesh.material,part:section});
  });
  if(!centers.length)return;
  const struck=centers.filter(c=>c.part===hitPart).map(c=>c.center);
  const seeds=fracture?[struck[Math.floor(Math.random()*struck.length)].clone()]:[],count=fracture?8+Math.floor(Math.random()*6):0;
  for(let n=1;n<count;n++){
   let best=null,score=-1;
   for(let j=0;j<80;j++){
    const c=struck[Math.floor(Math.random()*struck.length)];
    const d=Math.min(...seeds.map(s=>s.distanceToSquared(c)))*(.6+Math.random()*.8);
    if(d>score){score=d;best=c;}
   }
   seeds.push(best.clone());
  }
  const parts=seeds.map(()=>hitPart);
  for(const part of new Set(centers.map(c=>c.part))){
   if(fracture&&part===hitPart)continue;
   const points=centers.filter(c=>c.part===part),center=new THREE.Vector3();
   for(const point of points)center.add(point.center);
   seeds.push(center.divideScalar(points.length));parts.push(part);
  }
  const groups=seeds.map(seed=>{const group=new THREE.Group();group.position.copy(seed);this.scene.add(group);return group;});
  const materials=[];
  for(const surface of surfaces){
   const buckets=seeds.map(()=>[]);
   for(const t of surface.triangles){
    let nearest=0,distance=Infinity;
    seeds.forEach((seed,i)=>{if(parts[i]!==surface.part)return;const d=seed.distanceToSquared(t.center);if(d<distance){distance=d;nearest=i;}});
    buckets[nearest].push(t.i,t.i+1,t.i+2);
   }
   const material=surface.material.clone();material.transparent=true;material.side=THREE.DoubleSide;
   // Do not bake the final damage flash into every falling fragment.
   if(material.name==='Base')material.emissive.setHex(0x000000);
   materials.push(material);
   buckets.forEach((indices,bucket)=>{
    if(!indices.length)return;
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(surface.geometry.attributes)){
     const data=new Float32Array(indices.length*attribute.itemSize);
     indices.forEach((index,j)=>{for(let k=0;k<attribute.itemSize;k++)data[j*attribute.itemSize+k]=attribute.array[index*attribute.itemSize+k];});
     geometry.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize));
    }
    geometry.translate(-seeds[bucket].x,-seeds[bucket].y,-seeds[bucket].z);geometry.computeBoundingSphere();
    groups[bucket].add(new THREE.Mesh(geometry,material));
   });

  }
  for(const geometry of new Set(surfaces.map(s=>s.geometry)))geometry.dispose();
  const seamMaterial=new THREE.LineBasicMaterial({color:['tank','enemyTank'].includes(event.subject)?0x518da0:0xa53029,transparent:true,opacity:1,depthWrite:false});
  materials.push(seamMaterial);
  for(let i=0;i<groups.length;i++)if(fracture&&parts[i]===hitPart){
   for(const mesh of [...groups[i].children]){
    const seams=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,180),seamMaterial);
    mesh.add(seams);
   }
  }
  const blastBias=new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).multiplyScalar(.45);
  const pieces=groups.map((group,index)=>{
   const fragmented=fracture&&parts[index]===hitPart;
   // Intact Recognizer sections blast away from the craft's center instead of
   // all travelling to the same side of an off-center bullet impact.
   const origin=!fragmented&&motion===BREAKUP_MOTION.recognizer?craft.root.position:impact;
   const direction=group.position.clone().sub(origin).normalize();
   if(motion===BREAKUP_MOTION.recognizer)direction.add(blastBias).normalize();
   const impulse=(fragmented?5+Math.random()*11:2+Math.random()*4)*motion.impulseScale;
   // Faster outward separation without kicking debris twice as high.
   direction.y/=motion.impulseScale;
   const spin=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar((fragmented?3:.8)*motion.spinScale);
   // Long, intact sections tip end-over-end; small shards spin more freely.
   if(!fragmented&&motion===BREAKUP_MOTION.recognizer)spin.y*=.2;
   const delay=motion===BREAKUP_MOTION.recognizer&&!fragmented?.03+Math.random()*.12:Math.random()*motion.delay;
   return {group,part:parts[index],fragmented,velocity:direction.multiplyScalar(impulse).add(new THREE.Vector3(event.vx||0,(event.vy||0)+motion.lift+Math.random()*motion.liftVariation,-(event.vs||0))),spin,delay};
  });
  const flash=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:new THREE.Color(5,4.4,1.7),transparent:true,depthWrite:false}));
  flash.position.copy(impact);this.scene.add(flash);
  const optical=motion===BREAKUP_MOTION.recognizer?createBlast(impact):null;
  if(optical)this.scene.add(optical.mesh,optical.sparks);
  this.bursts.push({pieces,materials,flash,optical,hitPart,motion,subject:event.subject||'recognizer',age:0,life:motion.life+Math.random()*motion.lifeVariation});
 }
 update(dt){
  for(const burst of [...this.bursts]){
   burst.age+=dt;
   const flash=Math.max(0,1-burst.age/burst.motion.flash);burst.flash.visible=!burst.optical&&flash>0;
   burst.optical?.update(burst.age);
   burst.flash.scale.setScalar(1+(1-flash)*5);burst.flash.material.opacity=flash;
   for(const piece of burst.pieces){
    if(burst.age<piece.delay)continue;
    const p=piece.group.position,old=p.clone();
    piece.velocity.y-=burst.motion.gravity*dt;piece.velocity.multiplyScalar(Math.exp(-.12*dt));
    p.addScaledVector(piece.velocity,dt);
    const hit=wallIntersection({x:old.x,y:old.y,s:-old.z},{x:p.x,y:p.y,s:-p.z});
    if(hit!==null){p.copy(old);piece.velocity.multiplyScalar(-.2);piece.spin.multiplyScalar(.5);}
    if(p.y<.5){p.y=.5;piece.velocity.y=Math.abs(piece.velocity.y)*.2;piece.velocity.x*=.8;piece.velocity.z*=.8;piece.spin.multiplyScalar(.8);}
    piece.group.rotation.x+=piece.spin.x*dt;piece.group.rotation.y+=piece.spin.y*dt;piece.group.rotation.z+=piece.spin.z*dt;
   }
   const opacity=Math.min(1,(burst.life-burst.age)/burst.motion.fade);
   for(const material of burst.materials)material.opacity=Math.max(0,opacity);
   if(burst.age>=burst.life)this.remove(burst);
  }
 }
 remove(burst){
  for(const {group} of burst.pieces){group.traverse(o=>o.geometry?.dispose());this.scene.remove(group);}
  for(const material of burst.materials)material.dispose();
  this.scene.remove(burst.flash);burst.flash.geometry.dispose();burst.flash.material.dispose();
  if(burst.optical){this.scene.remove(burst.optical.mesh,burst.optical.sparks);burst.optical.dispose();}
  this.bursts=this.bursts.filter(b=>b!==burst);
 }
 clear(){for(const burst of [...this.bursts])this.remove(burst);}
}
