import {LIGHT_CYCLES as C} from './light-cycles.js';
export const ARENA_WALL=Object.freeze({innerMeters:409.06,outerMeters:465.72,cycleRadiusMeters:.8,
  // [height, center offset, half width], meters. Shared jagged opening profile.
  profile:[[0,0,7],[2.5,.5,7.5],[5,0,4],[12,-1,2.2],[24,-.8,1.3],[35,.3,1.1],[40,3,1.8],[49,-3,.8],[50,-4,0]],
  // Narrow splinter openings radiate from the impact; height, offset, half-width.
  branches:[
    [[2,0,3],[10,-4,1.5],[20,-8,.8],[27,-11,0]],
    [[3,0,2],[17,-3,1],[29,-6,.6],[38,-10,0]],
    [[2,1,3],[12,6,1.3],[18,9,.6],[28,12,0]],
    [[1,0,3],[7,9,1],[13,18,0]],
    [[5,0,2],[20,2,.8],[32,1.7,.6],[35,.8,0]],
  ],
});
export function wallImpact(x,z){
 const axis=Math.abs(x)>=Math.abs(z)?'x':'z',value=axis==='x'?x:z;
 return {axis,sign:Math.sign(value),along:axis==='x'?z:x};
}
export function breachContains(b,along){
 const low=ARENA_WALL.profile.slice(0,2);
 return low.every(([,offset,width])=>Math.abs(along-b.along-offset)+ARENA_WALL.cycleRadiusMeters<width);
}
export function arenaWallBlocked(r,x,z){
 const px=x*C.cellMeters,pz=z*C.cellMeters,rad=ARENA_WALL.cycleRadiusMeters;
 for(const axis of ['x','z']){
  const normal=axis==='x'?px:pz,along=axis==='x'?pz:px;
  if(Math.abs(normal)+rad<ARENA_WALL.innerMeters||Math.abs(normal)-rad>ARENA_WALL.outerMeters||Math.abs(along)>ARENA_WALL.outerMeters)continue;
  if(!r.breaches.some(b=>b.axis===axis&&b.sign===Math.sign(normal)&&breachContains(b,along)))return true;
 }
 return false;
}
