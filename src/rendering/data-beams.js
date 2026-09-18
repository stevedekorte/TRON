import * as THREE from 'three';
import {DATA_BEAM} from '../simulation/data-beams.js';
import {MAZE_INSTANCES} from '../levels/maze.js';
const SHUTDOWN={flareSeconds:.18,lift:1800,ringRadius:45};
const effectMaterial=color=>new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide});
export class DataBeams{
 constructor(scene){
  this.beams=MAZE_INSTANCES.map(()=>{
   const group=new THREE.Group();
   for(const [radius,color,opacity] of [[1.3,0xff3210,.95],[3,0xff1805,.28],[7,0xff1000,.07]]){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
    // Keep the open-ended column beyond the camera's ordinary far plane.
    material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n gl_Position.z=min(gl_Position.z,gl_Position.w*.99999);');};
    material.userData.baseOpacity=opacity;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,DATA_BEAM.height,12,1,true),material);
    shaft.position.y=DATA_BEAM.height/2;group.add(shaft);
   }
   const pool=new THREE.Mesh(new THREE.CircleGeometry(DATA_BEAM.radius,40),new THREE.MeshBasicMaterial({color:0xff2008,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
   pool.material.userData.baseOpacity=.3;pool.rotation.x=-Math.PI/2;pool.position.y=.04;group.add(pool);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.88,1,64),effectMaterial(0xff693b));
   ring.rotation.x=-Math.PI/2;ring.position.y=.09;ring.visible=false;group.add(ring);
   const pulse=new THREE.Mesh(new THREE.TorusGeometry(4,.6,8,48),effectMaterial(0xffb48a));
   pulse.rotation.x=-Math.PI/2;pulse.visible=false;group.add(pulse);
   const flare=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),effectMaterial(0xffc2a3));
   flare.position.y=2;flare.visible=false;group.add(flare);
   group.userData.effects={pool,ring,pulse,flare};
   scene.add(group);return group;
  });
 }
 update(run,visible){
  this.beams.forEach((group,i)=>{
   const beam=run.dataBeams?.[i];
   const active=beam?.collectedAt!=null,age=active?Math.max(0,run.time-beam.collectedAt):0;
   const progress=Math.min(1,age/DATA_BEAM.fadeSeconds),opacity=active?1-progress:1;
   group.visible=!!beam&&visible&&opacity>0;
   if(!beam)return;group.position.set(beam.x,0,-beam.s);
   const flareAmount=active?Math.max(0,1-age/SHUTDOWN.flareSeconds):0;
   for(const mesh of group.children.slice(0,3)){
    mesh.material.opacity=mesh.material.userData.baseOpacity*opacity*(1+flareAmount);
    mesh.scale.set(1-progress*.95+flareAmount*.6,1,1-progress*.95+flareAmount*.6);
    mesh.position.y=DATA_BEAM.height/2+SHUTDOWN.lift*progress*progress;
   }
   const {pool,ring,pulse,flare}=group.userData.effects;
   pool.material.opacity=.3*opacity*(1+flareAmount);pool.scale.setScalar(1+flareAmount);
   ring.visible=pulse.visible=flare.visible=active&&opacity>0;
   ring.scale.setScalar(DATA_BEAM.radius+SHUTDOWN.ringRadius*(1-(1-progress)**2));ring.material.opacity=opacity*.9;
   pulse.position.y=2+SHUTDOWN.lift*progress*progress;pulse.scale.setScalar(1-progress*.7);pulse.material.opacity=opacity;
   flare.scale.setScalar(2+flareAmount*7);flare.material.opacity=flareAmount*.7;
  });
 }
}
