import * as T from 'three';
import {RecognizerShadows} from './recognizer-shadows.js';
import {createCycleAtlasShadowBinding} from './cycle-atlas-shadows.js';

export const ARENA_WALL_SHADOWS=Object.freeze({size:2048,darkness:.6,depthBias:.0002,radiusMeters:760,lightDistanceMeters:2000});
export const arenaCycleShadows=createCycleAtlasShadowBinding({prefix:'arenaWall',maxCasters:1,darkness:ARENA_WALL_SHADOWS.darkness,depthBias:ARENA_WALL_SHADOWS.depthBias,includePacking:false});

// Static until geometry/placement changes. Breach replacement and round reset
// rebuild the caster list, including exposed fracture faces, before refreshing.
export class ArenaWallShadows extends RecognizerShadows {
 constructor(architecture,receivers){
  super([{root:architecture,casters:[],radius:ARENA_WALL_SHADOWS.radiusMeters,distance:ARENA_WALL_SHADOWS.lightDistanceMeters}],receivers,0,{...ARENA_WALL_SHADOWS,prefix:'arenaWallShadow',filterEdges:true});
  this.architecture=architecture;this.sources=[];this.worldMatrix=new T.Matrix4();this.ready=false;
 }
 update(renderer){
  const sources=[];this.architecture.updateWorldMatrix(true,true);
  this.architecture.traverse(mesh=>{if(mesh.isMesh&&mesh.visible)sources.push({mesh,geometry:mesh.geometry});});
  const changed=!this.ready||!this.worldMatrix.equals(this.architecture.matrixWorld)||sources.length!==this.sources.length||sources.some((s,i)=>s.mesh!==this.sources[i].mesh||s.geometry!==this.sources[i].geometry);
  if(!changed)return;
  const entry=this.entries[0];entry.scene.clear();entry.pairs=[];
  for(const {mesh:source,geometry} of sources){
   const mesh=new T.Mesh(geometry,this.depth);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;
   entry.scene.add(mesh);entry.pairs.push({source,mesh});
  }
  super.update(renderer);
  this.sources=sources;this.worldMatrix.copy(this.architecture.matrixWorld);this.ready=true;
 }
}
