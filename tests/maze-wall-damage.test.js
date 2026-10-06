import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MazeWallDamage,MAZE_WALL_DAMAGE as C} from '../src/rendering/maze-wall-damage.js';
function fixture(){
 const scene=new T.Scene(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,20,0,0,20,20,0,0,0,0,20,20,0,0,20,0],3));g.setAttribute('color',new T.Float32BufferAttribute(Array(18).fill(.05),3));g.setAttribute('shadowWallId',new T.Float32BufferAttribute(Array(6).fill(1),1));
 const slabs=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));slabs.userData.damageFaces=[{a:{x:0,s:0},b:{x:20,s:0},nx:0,ns:-1,ux:1,uz:0,length:20,height:20,start:0,shadowId:1,tone:[.02,.03,.05]}];scene.add(slabs);
 const seams=new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(0,10,.035),new T.Vector3(20,10,.035)]),new T.LineBasicMaterial());scene.add(seams);
 return {scene,slabs,seams,damage:new MazeWallDamage(scene,slabs,seams),hit:{subject:'surface',x:10,y:10,s:0,normal:{x:0,y:0,z:1}}};
}
test('wall damage creates a real recessed cavity and removes crossing seam sections',()=>{
 const {slabs,seams,damage,hit}=fixture();assert(damage.hit(hit));damage.update(0);
 const ray=new T.Raycaster(new T.Vector3(10,10,5),new T.Vector3(0,0,-1));slabs.updateMatrixWorld();
 const intersections=ray.intersectObject(slabs);assert(intersections.length);assert(intersections[0].point.z<-.5);
 assert.equal(seams.geometry.attributes.position.count,4);assert.equal(damage.cavities.length,1);assert.equal(damage.fragments.length,C.fragmentsPerHit);
 const radius=damage.cavities[0].radius;damage.hit({...hit,x:10.2});damage.update(0);assert.equal(damage.cavities.length,1);assert(damage.cavities[0].radius>radius);
 damage.dispose();
});
test('floor and vehicle hits are ignored; debris pauses, expires, and reset restores original geometry',()=>{
 const {slabs,seams,damage,hit}=fixture(),original=slabs.geometry,lines=seams.geometry;
 assert(!damage.hit({...hit,normal:{x:0,y:1,z:0}}));assert(!damage.hit({...hit,subject:'tank'}));
 damage.hit(hit);damage.update(.1);const p=damage.fragments[0].mesh.position.clone();damage.update(0);assert(damage.fragments[0].mesh.position.equals(p));
 for(let i=0;i<180;i++)damage.update(1/60);assert.equal(damage.fragments.length,0);assert.equal(damage.cavities.length,1);
 damage.clear();assert.equal(slabs.geometry,original);assert.equal(seams.geometry,lines);assert.equal(damage.cavities.length,0);damage.dispose();
});
test('repeated hits remain bounded and leave intact face borders',()=>{
 const {damage,hit}=fixture();
 for(let i=0;i<100;i++)damage.hit(hit);damage.update(0);
 assert(damage.cavities[0].radius<=C.maxRadiusMeters);assert(damage.cavities[0].depth<=C.maxDepthMeters);assert(damage.fragments.length<=C.maxFragments);
 assert(!damage.hit({...hit,x:0}));damage.dispose();
});
test('overlapping geometric cuts are sealed and reveal the deepest flat recess',()=>{
 const {slabs,damage,hit}=fixture();damage.hit(hit);damage.update(0);slabs.updateMatrixWorld();
 const c=damage.cavities[0];let recessed=0,intact=0,overlaps=0;
 for(let y=8.5;y<11.5;y+=.13)for(let x=8.5;x<11.5;x+=.13){
  const covering=c.cuts.filter(cut=>cut.shape.every((a,i)=>{
   const b=cut.shape[(i+1)%cut.shape.length],px=(x-c.x)/c.radius,py=(y-c.y)/c.radius;
   return (b[0]-a[0])*(py-a[1])-(b[1]-a[1])*(px-a[0])>=0;
  }));
  const expected=Math.max(0,...covering.map(cut=>c.depth*cut.depthScale));
  const hits=new T.Raycaster(new T.Vector3(x,y,5),new T.Vector3(0,0,-1)).intersectObject(slabs);
  assert(hits.length,'fracture has no unintended through-holes');
  assert(Math.abs(hits[0].point.z+expected)<1e-5,'overlap exposes deepest prism, without a shallower face covering it');
  if(expected>0)recessed++;else intact++;
  if(covering.length>1)overlaps++;
 }
 assert(recessed>20&&intact>20&&overlaps>10);damage.dispose();
});
