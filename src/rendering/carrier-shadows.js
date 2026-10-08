import {RecognizerShadows} from './recognizer-shadows.js';

export const CARRIER_SHADOWS=Object.freeze({size:4096,radius:750,distance:1800,darkness:.65,depthBias:.00002,filterEdges:'soft'});

// Hull-only casters avoid duplicating the carrier's painted trim and lights.
export class CarrierShadows extends RecognizerShadows {
 constructor(carrier,world,vehicles){
  const casters=[];
  carrier.traverse(o=>{if(o.isMesh&&o.material?.name.startsWith('TxTC01'))casters.push(o);});
  const receivers=[world.slabs,world.seams,world.floor,...(world.carrierShadowOverlays||[])];
  for(const root of vehicles)root.traverse(o=>{if(o.isMesh&&!o.userData.breakupExclude)receivers.push(o);});
  super([{root:carrier,casters,rez:carrier.userData.rez,radius:CARRIER_SHADOWS.radius,distance:CARRIER_SHADOWS.distance}],receivers,0,{...CARRIER_SHADOWS,prefix:'carrierShadow'});
  // A compact Gaussian filter smooths coverage over 6×6 texels.
  // Compare each depth separately; never interpolate packed depth values.
  // At this hull span, one texel is about 0.37 m instead of 1.46 m.
  // Shade the existing floor material, including its procedural grid, rather
  // than painting a solid projected silhouette over those luminous lines.
 }
}
