import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {repairCyclePanelOverlaps} from '../src/rendering/cycle-panel-overlaps.js';
test('partially overlapping gray faces keep their union with a single surface per point',()=>{
 const scene=new T.Scene();
 for(const [offset,name] of [[0,'_LightGray_1'],[.2,'FrontColor']]){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([.084152,offset,0,.084152,1+offset,0,.084152,offset,1],3));g.computeVertexNormals();
  const m=new T.MeshBasicMaterial({side:T.DoubleSide});m.name=name;scene.add(new T.Mesh(g,m));
 }
 assert(repairCyclePanelOverlaps(scene)>0);scene.updateMatrixWorld(true);
 for(const [y,z] of [[.31,.17],[.07,.11],[1.05,.05]]){
  const hits=new T.Raycaster(new T.Vector3(1,y,z),new T.Vector3(-1,0,0)).intersectObjects(scene.children);
  assert.equal(hits.length,1,'no stacked faces or lost unique coverage');
 }
 let area=0;for(const m of scene.children){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);area+=b.sub(a).cross(c.sub(a)).length()/2;}}
 assert(Math.abs(area-.68)<1e-6);
 assert.equal(repairCyclePanelOverlaps(scene),0,'repair is stable when repeated');
});

test('overlap repair handles rotated meshes and preserves separated parallel layers',()=>{
 const scene=new T.Scene();
 const add=(depth,offset)=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
  m.rotation.y=.4;m.position.set(offset,0,depth);scene.add(m);return m;
 };
 const first=add(0,0),duplicate=add(0,0),separate=add(.001,0);
 assert.equal(repairCyclePanelOverlaps(scene),1);
 assert.equal(duplicate.geometry.attributes.position.count,0);
 assert.equal(first.geometry.attributes.position.count,3);
 assert.equal(separate.geometry.attributes.position.count,3);
});

test('gray plate winding and normals agree on both sides',async()=>{
 const {repairCyclePanelWinding}=await import('../src/rendering/cycle-rear-seams.js');
 const scene=new T.Scene();
 for(const sign of [-1,1]){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([sign*.0841,0,0,sign*.0841,0,1,sign*.0841,1,0],3));g.computeVertexNormals();
  const m=new T.MeshBasicMaterial();m.name='_LightGray_1';scene.add(new T.Mesh(g,m));
 }
 repairCyclePanelWinding(scene);
 for(const m of scene.children){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;
  const a=new T.Vector3().fromBufferAttribute(p,0),b=new T.Vector3().fromBufferAttribute(p,1),c=new T.Vector3().fromBufferAttribute(p,2);
  assert(b.sub(a).cross(c.sub(a)).x*a.x>0);
  for(let i=0;i<3;i++)assert.equal(n.getX(i),Math.sign(a.x));
 }
});
