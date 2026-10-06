import {fitCreditPreview,creditPreviewPoints} from './credit-preview-framing.js';
import {createCreditBit} from '../rendering/credit-bit.js';
import {repairCycleSurface,repairCycleHubs,removeCycleInscriptions} from '../rendering/cycle-surface.js';
import {createCreditMaze} from '../rendering/credit-maze.js';
import {solarSailerTransit} from '../game/solar-sailer.js';
import {loadSolarSailer,applySolarSailerState} from '../rendering/solar-sailer.js';
import {loadCarrier} from '../rendering/carrier.js';
import {createBossTank} from '../rendering/boss-tank.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTank} from '../rendering/models.js';
import {disposeSceneResources} from '../rendering/scene-resources.js';

const PREVIEW={gapPixels:40,minWidthPixels:260,edgeMarginPixels:40,bottomClearanceFraction:.25,fadeSeconds:.8,carrierLightingScale:.15,cycleLightingScale:.75,cycleBodyBlue:0x164b8a,cycleAccentBlue:0x2359b0,sailerStateTimeScale:3};
const models=[
 ['CONTROLLINGTRANSMISSION','bit',null],
 ['LOCAL MAZE AND LEVEL WORK','maze',null],
 ['ARABINOWITZ','tank',null],
 ['SPRINGSOCIETY','boss',null],
 ['SHRIKER1','recognizer',new URL('../../docs/models/tron_1982_recognizer.glb',import.meta.url).href],
 ['3D MODEL: TRON CARRIER','carrier',new URL('../../docs/models/tron_1982_carrier.glb',import.meta.url).href],
 ['3D MODEL: TRON SUNSHIP','sailer',new URL('../../docs/models/tron_1982_solar_sailer.glb',import.meta.url).href],
 ['JVOUILLON','cloud',new URL('../../docs/models/cloud.glb',import.meta.url).href],
 ['DANIEL PRETI','cycle',new URL('../../docs/models/preti_light_cycle_blue.glb',import.meta.url).href],
];
export function creditModel(message){return models.find(([label])=>message.includes(label));}

// Uses the existing credit frame loop. No extra animation loop or game-scene objects.
export class CreditModelPreview{
 constructor(){
  this.element=document.createElement('div');this.element.className='credit-model-preview';this.element.hidden=true;this.element.setAttribute('aria-hidden','true');document.body.append(this.element);
  this.measure=document.createElement('canvas').getContext('2d');this.generation=0;
 }
 reset(){
  this.generation++;this.key=null;this.age=0;this.element.hidden=true;
  if(this.model){this.scene.remove(this.model);disposeSceneResources(this.model);this.model=null;}
 }
 initialize(){
  if(this.renderer)return;
  this.renderer=new T.WebGLRenderer({alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0,0);
  this.element.append(this.renderer.domElement);this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(35,1,.01,100);
  this.scene.add(new T.HemisphereLight(0xd9edff,0x67718a,3));
  const light=new T.DirectionalLight(0xffffff,4);light.position.set(3,5,4);this.scene.add(light);
  const rim=new T.DirectionalLight(0x76baff,3);rim.position.set(-4,2,-3);this.scene.add(rim);
  this.scene.children.forEach(o=>{if(o.isLight)o.userData.previewIntensity=o.intensity;});
 }
 async load(entry,generation){
  try{
   const root=entry[1]==='sailer'?(await loadSolarSailer({previewBeam:true})).ship:entry[1]==='carrier'?await loadCarrier():entry[1]==='bit'?await createCreditBit():entry[1]==='maze'?createCreditMaze():entry[1]==='tank'?(await createTank()).root:entry[1]==='boss'?(await createBossTank()).root:(await new GLTFLoader().loadAsync(entry[2])).scene;
   if(generation!==this.generation){disposeSceneResources(root);return;}
   if(entry[1]==='cycle'){
    removeCycleInscriptions(root);
    root.traverse(o=>{if(o.isMesh){const original=o.geometry;o.geometry=repairCycleSurface(original);original.dispose();}});
    repairCycleHubs(root);
    root.traverse(o=>{
     for(const material of o.material?[].concat(o.material):[]){
      if(material.name==='_6')material.color.setHex(PREVIEW.cycleBodyBlue);
      if(material.name==='Color_I03')material.color.setHex(PREVIEW.cycleAccentBlue);
     }
    });
   }
   root.traverse(o=>{if((o.userData.breakupExclude&&!o.userData.bossTrim)||o.name==='muzzle-flash')o.visible=false;});
   if(entry[1]==='recognizer')root.traverse(o=>{
    for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
     if(material.name==='Base'){
      material.color.setHex(0x05070a);material.emissive?.setHex(0);material.roughness=1;material.metalness=0;
     }
    }
   });
   // A wrapper preserves the asset's internal transforms and original proportions.
   const box=new T.Box3().setFromPoints(creditPreviewPoints(root)),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   root.position.sub(center);const model=new T.Group();model.add(root);model.scale.setScalar(2/Math.max(size.x,size.y,size.z));
   if(entry[1]==='sailer'){this.sailerMaterials=new Set();root.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>this.sailerMaterials.add(m));});}
   this.model=model;this.scene.add(model);this.element.dataset.model=entry[1];
  }catch(error){if(generation===this.generation){this.element.hidden=true;console.warn('Credit model preview unavailable:',entry[1],error);}}
 }
 update(tribute,dt){
  const message=tribute.index>=tribute.extendedStart?tribute.sentences[tribute.index]:'',entry=creditModel(message);
  if(!entry||!tribute.active||tribute.phase==='signoff'||tribute.phase==='return'){if(this.key)this.reset();return;}
  const style=getComputedStyle(tribute.element),bounds=tribute.element.getBoundingClientRect();this.measure.font=style.font;
  const textWidth=Math.max(...message.split('\n').map(line=>this.measure.measureText(line).width+line.length*(parseFloat(style.letterSpacing)||0)));
  const left=bounds.left+textWidth+PREVIEW.gapPixels,width=innerWidth-left-PREVIEW.edgeMarginPixels,height=innerHeight-Math.max(PREVIEW.edgeMarginPixels,innerHeight*PREVIEW.bottomClearanceFraction)-bounds.top;
  if(width<PREVIEW.minWidthPixels||height<220||innerWidth<1000){if(this.key)this.reset();return;}
  if(this.key!==entry[1]){this.reset();this.initialize();this.key=entry[1];void this.load(entry,this.generation);}
  this.element.hidden=false;Object.assign(this.element.style,{left:`${left}px`,top:`${bounds.top}px`,width:`${width}px`,height:`${height}px`});
  if(tribute.count>0)this.age+=dt;
  const opacity=(tribute.reducedMotion?Number(tribute.count>0):Math.min(1,this.age/PREVIEW.fadeSeconds))*Number(tribute.typed.style.opacity||1);
  this.element.style.opacity=String(opacity);
  if(!this.model)return;
  if(this.key==='sailer')applySolarSailerState(this.sailerMaterials,solarSailerTransit(this.age*PREVIEW.sailerStateTimeScale).charge);
  this.scene.children.forEach(o=>{if(o.isLight)o.intensity=o.userData.previewIntensity*(this.key==='carrier'?PREVIEW.carrierLightingScale:this.key==='cycle'?PREVIEW.cycleLightingScale:1);});
  this.model.rotation.y=-.45; // Stable three-quarter inspection view, without distracting motion.
  if(this.framedModel!==this.model||this.width!==width||this.height!==height){fitCreditPreview(this.camera,this.model,width/height,this.key==='maze');this.framedModel=this.model;}
  if(this.width!==width||this.height!==height){this.renderer.setSize(width,height);this.width=width;this.height=height;}
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.reset();this.renderer?.dispose();this.element.remove();}
}
