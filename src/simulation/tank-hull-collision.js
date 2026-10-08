import {angleDelta} from '../game/config.js';
import {worldFor} from '../levels/scenario.js';
// Measured non-turret GLB bounds: width 6.5 m, length 9.373 m.
// Small clearance keeps the painted shell visibly outside the wall.
export const TANK_HULL=Object.freeze({halfWidthMeters:3.29,halfLengthMeters:4.73,turnStepRadians:.02});
export function tankHullPoints(p){
 const co=Math.cos(p.yaw),si=Math.sin(p.yaw);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const x=a*TANK_HULL.halfWidthMeters,z=b*TANK_HULL.halfLengthMeters;return {x:p.x+co*x+si*z,s:p.s+si*x-co*z};});
}
function separation(a,b){
 let best=null;
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],length=Math.hypot(q.x-p.x,q.s-p.s);if(length<1e-8)continue;
  let nx=(q.s-p.s)/length,ns=(p.x-q.x)/length;
  const pa=a.map(v=>v.x*nx+v.s*ns),pb=b.map(v=>v.x*nx+v.s*ns);
  const amin=Math.min(...pa),amax=Math.max(...pa),bmin=Math.min(...pb),bmax=Math.max(...pb);
  if(amax<=bmin+1e-7||bmax<=amin+1e-7)return null;
  const positive=bmax-amin,negative=amax-bmin;
  const depth=Math.min(positive,negative);if(negative<positive){nx=-nx;ns=-ns;}
  if(!best||depth<best.penetration)best={penetration:depth,nx,ns};
 }
 return best;
}
export function tankHullContact(run){
 const world=worldFor(run),hull=tankHullPoints(run),radius=Math.hypot(TANK_HULL.halfWidthMeters,TANK_HULL.halfLengthMeters);
 let hit=null;
 for(const wall of world.nearbyWalls(run.x,run.s,radius)){
  const polygons=wall.triangles?.map(t=>t.map(e=>e.a))||[wall.points];
  for(const poly of polygons){
   const contact=separation(hull,poly);if(!contact||hit&&contact.penetration<=hit.penetration)continue;
   // The physical wall face supplies a stable impact point and outward normal.
   const corner=hull.reduce((best,p)=>p.x*contact.nx+p.s*contact.ns<best.x*contact.nx+best.s*contact.ns?p:best);
   const point=world.closestWallPoint(wall,corner.x,corner.s);
   hit={...contact,x:point.x,s:point.s,y:1.2,normal:{x:point.nx,y:0,z:-point.ns}};
  }
 }
 return hit;
}
export function constrainHullTurn(run,oldYaw){
 const desired=run.yaw,delta=angleDelta(oldYaw,desired),steps=Math.max(1,Math.ceil(Math.abs(delta)/TANK_HULL.turnStepRadians));
 run.yaw=oldYaw;let safe=oldYaw,depth=tankHullContact(run)?.penetration??0;
 for(let i=1;i<=steps;i++){
  run.yaw=oldYaw+delta*i/steps;const next=tankHullContact(run)?.penetration??0;
  if(next>depth+1e-6){run.yaw=safe;run.steer=0;return true;}
  safe=run.yaw;depth=next;
 }
 return false;
}
