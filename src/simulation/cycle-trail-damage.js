import {LIGHT_CYCLES as C,cycleTrailState} from '../game/light-cycles.js';
import {cycleTrailLength} from '../game/cycle-trails.js';
import {rebuildTrailOccupancy} from './cycle-trails.js';

function replaceTrails(r,replace){
 const active=r.cycles.map(b=>r.trails[b.segment]),replacements=new Map();
 r.trails=r.trails.flatMap(t=>{const parts=replace(t);replacements.set(t,parts.find(p=>p.dyingAt===undefined&&Math.abs(p.x2-t.x2)<1e-8&&Math.abs(p.z2-t.z2)<1e-8));return parts;});
 r.cycles.forEach((b,i)=>{b.segment=r.trails.indexOf(replacements.get(active[i]));});
}

// Trail order is chronological, even after turns. Cut by path distance so a
// collision near a corner also removes the short piece on the other side.
export function damageCycleTrail(r,ownerId,x,z){
 const owner=r.cycles.find(b=>b.id===ownerId);if(!owner)return false;
 let length=0,hit=null;
 const ranges=new Map();
 for(const t of r.trails){
  if(t.bikeId!==ownerId)continue;
  const size=cycleTrailLength(t),dx=t.x2-t.x1,dz=t.z2-t.z1,l2=dx*dx+dz*dz;
  const f=l2?Math.max(0,Math.min(1,((x-t.x1)*dx+(z-t.z1)*dz)/l2)):0;
  if(l2&&Math.hypot(x-t.x1-f*dx,z-t.z1-f*dz)<1e-5)hit=length+f*size;
  ranges.set(t,{start:length,size});length+=size;
 }
 if(hit===null)return false;
 const low=Math.max(0,hit-C.trailImpactHalfGapMeters),high=Math.min(length,hit+C.trailImpactHalfGapMeters);
 replaceTrails(r,t=>{
  const range=ranges.get(t);if(!range)return [t];
  const {start,size}=range,end=start+size,parts=[];
  const piece=(a,b,older)=>{
   if(b-a<1e-8||size<1e-8)return;
   const f1=(a-start)/size,f2=(b-start)/size;
   parts.push({...t,x1:t.x1+(t.x2-t.x1)*f1,z1:t.z1+(t.z2-t.z1)*f1,x2:t.x1+(t.x2-t.x1)*f2,z2:t.z1+(t.z2-t.z1)*f2,
    ...(older?{dyingAt:Math.min(t.dyingAt??Infinity,r.time)}:{})});
  };
  piece(start,Math.min(end,low),true);piece(Math.max(start,high),end,false);return parts;
 });
 rebuildTrailOccupancy(r,[owner]);return true;
}
export function expireDamagedTrails(r){
 const removed=new Set(r.trails.filter(t=>t.dyingAt!==undefined&&cycleTrailState(r.time-t.dyingAt).height<=0));
 if(!removed.size)return;
 const owners=new Set([...removed].map(t=>t.bikeId));
 replaceTrails(r,t=>removed.has(t)?[]:[t]);
 rebuildTrailOccupancy(r,r.cycles.filter(b=>owners.has(b.id)));
}
