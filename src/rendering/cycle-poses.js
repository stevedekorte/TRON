import {cycleFraction} from '../game/light-cycles.js';
/** One fixed step of visual interpolation, shared by bikes, trails and camera.
 * Collision state remains untouched; deaths/results display their impact pose. */
export function interpolateCycleRace(race,alpha){
 if(!race||race.phase!=='racing'&&!race.cycles.some(b=>b.alive&&b.escaped)||alpha>=1)return race;
 const blend=Math.max(0,alpha);
 return {...race,cycles:race.cycles.map(b=>{
  if(!b.alive||!b.renderPrevious)return b;
  const f=cycleFraction(race,b),old=b.renderPrevious;
  let x=old.x+(b.previousX+(b.x-b.previousX)*f-old.x)*blend;
  let z=old.z+(b.previousZ+(b.z-b.previousZ)*f-old.z)*blend;
  if(!b.escaped&&old.dir!==b.dir){
   const before=Math.hypot(b.previousX-old.x,b.previousZ-old.z);
   const after=Math.hypot(b.x-b.previousX,b.z-b.previousZ)*f;
   const along=(before+after)*blend;
   if(along<before){const t=along/before;x=old.x+(b.previousX-old.x)*t;z=old.z+(b.previousZ-old.z)*t;}
   else {const t=after?(along-before)/after:0;x=b.previousX+(b.x-b.previousX)*f*t;z=b.previousZ+(b.z-b.previousZ)*f*t;}
  }
  const yaw=b.yaw===undefined?undefined:(old.yaw??b.yaw)+(b.yaw-(old.yaw??b.yaw))*blend;
  const lean=(old.lean??b.lean??0)+((b.lean??0)-(old.lean??b.lean??0))*blend;
  return {...b,yaw,lean,x,previousX:x,z,previousZ:z,progress:f-(1-blend)*b.renderTravel};
 })};
}
