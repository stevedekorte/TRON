import {DEFAULT_WORLD,worldFor} from '../levels/scenario.js';
import * as THREE from 'three';
import {DATA_BEAM,dataRingSweep} from '../simulation/data-beams.js';
const RED=new THREE.Color(0xff2008),WHITE=new THREE.Color(0xffeeee),BLUE=new THREE.Color(0x168aff);
const effectMaterial=color=>new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide});
// Project sky-reaching shafts against the far plane without visible clipped ends.
function skyMaterial(material){
 material.fog=false;
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n gl_Position.z=min(gl_Position.z,gl_Position.w*.99999);');};
 return material;
}
export class DataBeams{
 constructor(scene,world=DEFAULT_WORLD){
  const {MAZE_INSTANCES}=world;
  this.beams=MAZE_INSTANCES.map(()=>{
   const group=new THREE.Group();
   for(const [radius,color,opacity] of [[1.3,0xff3210,.95],[3,0xff1805,.28],[7,0xff1000,.07]]){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
    skyMaterial(material);
    material.userData.baseOpacity=opacity;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,DATA_BEAM.height,12,1,true),material);
    shaft.position.y=DATA_BEAM.height/2;group.add(shaft);
   }
   const pool=new THREE.Mesh(new THREE.CircleGeometry(DATA_BEAM.radius,40),new THREE.MeshBasicMaterial({color:0xff2008,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
   // Draw the floor glow after floor/shadows, before solid vehicles/walls.
   // Avoid near-coplanar depth comparisons at distant maze coordinates.
   pool.material.transparent=false;pool.material.depthTest=false;pool.renderOrder=-.5;
   pool.material.userData.baseOpacity=.3;pool.rotation.x=-Math.PI/2;pool.position.y=.04;group.add(pool);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.88,1,64),effectMaterial(0xff693b));
   ring.material.transparent=false;ring.material.depthTest=false;ring.renderOrder=-.5;
   ring.rotation.x=-Math.PI/2;ring.position.y=.09;ring.visible=false;group.add(ring);
   const pulse=new THREE.Mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2),effectMaterial(0x49aaff));
   pulse.rotation.x=-Math.PI/2;pulse.visible=false;group.add(pulse);
   const flare=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),effectMaterial(0xffc2a3));
   flare.position.y=2;flare.visible=false;group.add(flare);
   const curtain=new THREE.Group();
   const panelWidth=2*DATA_BEAM.ringRadius*Math.tan(Math.PI/DATA_BEAM.ringPanels)-DATA_BEAM.ringPanelGap;
   const panelGeometry=new THREE.PlaneGeometry(panelWidth,1);
   const edgeGeometry=new THREE.PlaneGeometry(DATA_BEAM.ringEdgeWidth,1);
   for(let j=0;j<DATA_BEAM.ringPanels;j++){
    const panel=new THREE.Group(),angle=j/DATA_BEAM.ringPanels*Math.PI*2;
    const face=new THREE.Mesh(panelGeometry,skyMaterial(effectMaterial(0x329dff)));
    face.material.opacity=DATA_BEAM.ringPanelOpacity;panel.add(face);
    for(const side of [-1,1]){
     const edge=new THREE.Mesh(edgeGeometry,skyMaterial(effectMaterial(0x9eeaff)));
     edge.position.x=side*(panelWidth-DATA_BEAM.ringEdgeWidth)/2;edge.material.opacity=DATA_BEAM.ringEdgeOpacity;panel.add(edge);
    }
    panel.position.set(Math.cos(angle)*DATA_BEAM.ringRadius,DATA_BEAM.height/2,Math.sin(angle)*DATA_BEAM.ringRadius);
    panel.rotation.y=-Math.PI/2-angle;panel.scale.y=DATA_BEAM.height;curtain.add(panel);
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
   group.visible=!!beam&&visible;
   if(!beam)return;group.position.set(beam.x,0,-beam.s);
   const progress=active?1:beam.transferStartedAt===null?0:THREE.MathUtils.clamp((run.time-beam.transferStartedAt)/DATA_BEAM.transferSeconds,0,1);
   const color=progress<.5?RED.clone().lerp(WHITE,progress*2):WHITE.clone().lerp(BLUE,(progress-.5)*2);
   const flareAmount=active?Math.max(0,1-age/.4):0;
   for(const mesh of group.children.slice(0,3)){
    mesh.material.color.copy(color);
    mesh.material.opacity=mesh.material.userData.baseOpacity*(1+flareAmount);
   }
   const {pool,ring,pulse,flare,curtain}=group.userData.effects;
   const sweep=dataRingSweep(beam,run.time);
   curtain.visible=sweep>0;
   curtain.position.set(0,0,0);
   curtain.children.forEach((bar,j)=>{
    // Switch each entire panel on in sequence; opening reverses that sequence.
    bar.visible=sweep>(j/curtain.children.length);
   });
   pool.material.color.copy(color);pool.material.opacity=.3*(1+flareAmount);
   const wave=DATA_BEAM.blastEnabled&&active&&age<DATA_BEAM.blastSeconds;
   ring.visible=pulse.visible=wave;flare.visible=flareAmount>0;
   const fade=Math.min(1,(DATA_BEAM.blastSeconds-age)/2);
   const radius=Math.max(.01,beam.waveRadius||0);
   ring.material.color.copy(BLUE);ring.scale.setScalar(radius);ring.material.opacity=wave?fade*.65:0;
   pulse.rotation.x=0;pulse.scale.setScalar(radius);pulse.material.opacity=wave?fade*.035:0;
   flare.material.color.copy(WHITE);flare.scale.setScalar(2+flareAmount*7);flare.material.opacity=flareAmount*.7;
  });
 }
}
