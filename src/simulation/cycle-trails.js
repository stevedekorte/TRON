import {LIGHT_CYCLES as C} from '../game/light-cycles.js';
import {CYCLE_TRAIL_LIMIT,cycleTrailLength,cycleTrailHeadTrim} from '../game/cycle-trails.js';

// Keep trail geometry and occupied cells together: expired wall is driveable.
export function trimCycleTrails(r){
 const removed=new Set(),changed=[];
 for(const b of r.cycles){
  const segments=r.trails.filter(t=>t.bikeId===b.id);
  let excess=segments.reduce((sum,t)=>sum+cycleTrailLength(t),0)-cycleTrailHeadTrim(r,b)-CYCLE_TRAIL_LIMIT.lengthMeters;
  if(excess<=1e-8)continue;
  changed.push(b);
  b.expiredTrailMeters=(b.expiredTrailMeters??0)+excess;
  for(const t of segments){
   const length=cycleTrailLength(t);
   if(excess>=length){removed.add(t);excess-=length;}
   else{
    const fraction=excess/length;
    t.x1+=(t.x2-t.x1)*fraction;t.z1+=(t.z2-t.z1)*fraction;
    break;
   }
  }
 }
 if(!changed.length)return;
 const active=r.cycles.map(b=>r.trails[b.segment]);
 r.trails=r.trails.filter(t=>!removed.has(t));
 r.cycles.forEach((b,i)=>{b.segment=r.trails.indexOf(active[i]);});
 rebuildTrailOccupancy(r,changed);
}

export function rebuildTrailOccupancy(r,changed){
 const side=C.halfCells*2+1;
 const mark=(x,z,id)=>{
  x=Math.round(x);z=Math.round(z);
  if(Math.abs(x)<=C.halfCells&&Math.abs(z)<=C.halfCells){
   const index=(z+C.halfCells)*side+x+C.halfCells;
   if(!r.occupied[index]||r.occupied[index]===id)r.occupied[index]=id;
  }else{
   const key=`${x},${z}`;
   if(!r.outerOccupied[key]||r.outerOccupied[key]===id)r.outerOccupied[key]=id;
  }
 };
 for(const b of changed){
  if(r.crashes?.some(c=>c.id===b.id&&c.trailCleared))continue;
  const id=b.id+1;
  for(let i=0;i<r.occupied.length;i++)if(r.occupied[i]===id)r.occupied[i]=0;
  for(const key of Object.keys(r.outerOccupied))if(r.outerOccupied[key]===id)delete r.outerOccupied[key];
  for(const t of r.trails){
   if(t.bikeId!==b.id)continue;
   // Integer grid cells represent the axis-aligned arena barriers. Sampling
   // also covers the short diagonal joining segment after road reentry.
   const steps=Math.max(1,Math.ceil(Math.hypot(t.x2-t.x1,t.z2-t.z1)*2));
   if(Math.abs(t.z2-t.z1)<1e-8){for(let x=Math.ceil(Math.min(t.x1,t.x2)-1e-8);x<=Math.floor(Math.max(t.x1,t.x2)+1e-8);x++)mark(x,t.z1,id);}
   else if(Math.abs(t.x2-t.x1)<1e-8){for(let z=Math.ceil(Math.min(t.z1,t.z2)-1e-8);z<=Math.floor(Math.max(t.z1,t.z2)+1e-8);z++)mark(t.x1,z,id);}
   else for(let i=0;i<=steps;i++)mark(t.x1+(t.x2-t.x1)*i/steps,t.z1+(t.z2-t.z1)*i/steps,id);
  }
  if(b.alive&&!b.escaped)mark(b.x,b.z,id);
 }
}
