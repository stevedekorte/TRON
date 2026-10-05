import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BOSS_TANK as B} from '../game/boss-tank.js';
const url=new URL('../../docs/models/extra/double_turret_clu_light_tank.glb',import.meta.url).href;
export async function createBossTank(){
 const {scene}=await new GLTFLoader().loadAsync(url);scene.updateMatrixWorld(true);
 const root=new THREE.Group(),turret=new THREE.Group(),barrel=new THREE.Group(),flash=new THREE.Group();
 root.name='Boss — Double turret Clu Light Tank by SpringSociety';
 turret.position.set(...B.pivot);root.add(turret);turret.add(barrel);barrel.add(flash);
 flash.visible=false;flash.userData.breakupExclude=true;
 const normalize=new THREE.Matrix4().makeScale(-B.scale,B.scale,-B.scale)
  .multiply(new THREE.Matrix4().makeTranslation(0,-B.sourceFloor,-B.sourceCenterZ));
 const shadowMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,side:THREE.DoubleSide,
  vertexShader:'void main(){vec4 world=modelMatrix*vec4(position,1.);world.xz+=vec2(.5,.5)*world.y;world.y=.025;gl_Position=projectionMatrix*viewMatrix*world;}',
  fragmentShader:'void main(){gl_FragColor=vec4(0.,.001,.004,1.);}'
 });
 const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const originals=new Set(),textures=new Set();
 const body=new THREE.MeshPhongMaterial({name:'Boss_Body_Black',color:0x070b10,specular:0x7ed9f2,shininess:48,side:THREE.DoubleSide});
 const trim=new THREE.LineBasicMaterial({name:'Boss_Red_Trim',color:0x76190f});
 for(const mesh of meshes){
  originals.add(mesh.material);for(const v of Object.values(mesh.material))if(v?.isTexture)textures.add(v);
  const moving=/Mesh_00(02|28|29)_/.test(mesh.name);
  mesh.geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize,mesh.matrixWorld));
  if(moving)mesh.geometry.translate(-B.pivot[0],-B.pivot[1],-B.pivot[2]);
  mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);mesh.material=body;
  (moving?barrel:root).add(mesh);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,35),trim);
  edges.userData.breakupExclude=true;edges.userData.bossTrim=true;mesh.add(edges);
  const shadow=new THREE.Mesh(mesh.geometry,shadowMaterial);shadow.frustumCulled=false;shadow.renderOrder=-1;shadow.userData.breakupExclude=true;mesh.parent.add(shadow);
 }
 originals.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
 for(const muzzle of B.muzzles){
  const light=new THREE.Mesh(new THREE.SphereGeometry(.3,10,6),new THREE.MeshBasicMaterial({color:0xe0faff}));
  light.position.set(...muzzle.map((v,i)=>v-B.pivot[i]));light.userData.breakupExclude=true;flash.add(light);
 }
 return {root,turret,barrel,flash,tracks:[],source:'SpringSociety'};
}
