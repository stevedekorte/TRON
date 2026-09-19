import {RecognizerShadows} from './recognizer-shadows.js';

// Hull-only casters avoid duplicating the carrier's painted trim and lights.
export class CarrierShadows extends RecognizerShadows {
 constructor(carrier,world,vehicles){
  const casters=[];
  carrier.traverse(o=>{if(o.isMesh&&o.material?.name.startsWith('TxTC01'))casters.push(o);});
  const receivers=[world.slabs,world.seams,world.floor];
  for(const root of vehicles)root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)receivers.push(o);});
  super([{root:carrier,casters,radius:750,distance:1800}],receivers,0,{size:1024,prefix:'carrierShadow',darkness:.5});
  // Shade the existing floor material, including its procedural grid, rather
  // than painting a solid projected silhouette over those luminous lines.
 }
}
