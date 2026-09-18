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
   const curtain=new THREE.Group();
   const shaftGeometry=new THREE.CylinderGeometry(.07,.07,1,6,1,true);
   const glowGeometry=new THREE.CylinderGeometry(.3,.3,1,8,1,true);
   for(let j=0;j<32;j++){
    const bar=new THREE.Group(),angle=j/32*Math.PI*2;
    const core=new THREE.Mesh(shaftGeometry,effectMaterial(0x75cfff));
    const halo=new THREE.Mesh(glowGeometry,effectMaterial(0x168aff));
    bar.add(core,halo);bar.position.set(Math.cos(angle)*8.5,0,Math.sin(angle)*8.5);curtain.add(bar);
   }
   group.add(curtain);
   group.userData.effects={pool,ring,pulse,flare,curtain};
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
   const {pool,ring,pulse,flare,curtain}=group.userData.effects;
   const transferAge=beam.transferStartedAt===null?-1:run.time-beam.transferStartedAt;
   const end=DATA_BEAM.buildSeconds+DATA_BEAM.holdSeconds;
   const sweep=transferAge<0||active?0:transferAge<end?Math.min(1,transferAge/DATA_BEAM.buildSeconds):Math.max(0,1-(transferAge-end)/DATA_BEAM.retractSeconds);
   curtain.visible=sweep>0;
   curtain.position.set((beam.transferX??beam.x)-beam.x,0,-((beam.transferS??beam.s)-beam.s));
   curtain.children.forEach((bar,j)=>{
    // Successive shafts descend around the tank; reversing sweep unwinds them.
    const t=THREE.MathUtils.smoothstep(sweep,j/32*.65,j/32*.65+.35);
    const height=22*t;bar.visible=t>0;bar.position.y=22-height/2;
    bar.scale.y=Math.max(.001,height);
    bar.children[0].material.opacity=.32*t;
    bar.children[1].material.opacity=.045*t;
   });
   pool.material.opacity=.3*opacity*(1+flareAmount);pool.scale.setScalar(1+flareAmount);
   ring.visible=pulse.visible=flare.visible=active&&opacity>0;
   ring.scale.setScalar(DATA_BEAM.radius+SHUTDOWN.ringRadius*(1-(1-progress)**2));ring.material.opacity=opacity*.9;
   pulse.position.y=2+SHUTDOWN.lift*progress*progress;pulse.scale.setScalar(1-progress*.7);pulse.material.opacity=opacity;
   flare.scale.setScalar(2+flareAmount*7);flare.material.opacity=flareAmount*.7;
  });
 }
}
