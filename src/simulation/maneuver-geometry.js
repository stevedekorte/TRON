import {nearbyWalls,WALL_HEIGHT} from '../levels/maze.js';
import {RECOGNIZER_SCALE,angleDelta} from '../game/config.js';
import {TACTICAL} from '../game/tactical.js';
export const AIR_HULL=Object.freeze({halfWidth:18*RECOGNIZER_SCALE,halfDepth:6.5*RECOGNIZER_SCALE,bottom:22*RECOGNIZER_SCALE,top:8*RECOGNIZER_SCALE});
export const SAFE_ALTITUDE=WALL_HEIGHT+AIR_HULL.bottom+8;
function corners(p,margin){
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),out=[];
 for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
  const a=x*(AIR_HULL.halfWidth+margin),b=z*(AIR_HULL.halfDepth+margin);
  out.push({x:p.x+c*a+s*b,s:p.s+s*a-c*b});
 }
 return out;
}
function overlap(a,b){
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=q.s-p.s,ns=p.x-q.x;
  const pa=a.map(v=>v.x*nx+v.s*ns),pb=b.map(v=>v.x*nx+v.s*ns);
  if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false;
 }
 return true;
}
export function aircraftPoseClear(p,walls=null,margin=TACTICAL.clearance){
 if(p.y<AIR_HULL.bottom-.001)return false;
 const footprint=corners(p,margin),radius=Math.hypot(AIR_HULL.halfWidth+margin,AIR_HULL.halfDepth+margin);
 for(const wall of walls||nearbyWalls(p.x,p.s,radius)){
  if(p.y-AIR_HULL.bottom>wall.height+margin)continue;
  const polygons=wall.triangles?.map(t=>t.map(edge=>edge.a))||[wall.points];
  if(polygons.some(poly=>overlap(footprint,poly)))return false;
 }
 return true;
}
export function aircraftSweepClear(a,b,walls=null){
 const roof=walls?Math.max(0,...walls.map(w=>w.height)):WALL_HEIGHT;
 if(Math.min(a.y,b.y)-AIR_HULL.bottom>roof+TACTICAL.clearance)return true;
 const yaw=angleDelta(a.yaw,b.yaw),distance=Math.hypot(b.x-a.x,b.s-a.s,b.y-a.y);
 const steps=Math.max(1,Math.ceil(distance/TACTICAL.sweepStep),Math.ceil(Math.abs(yaw)/TACTICAL.yawStep));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!aircraftPoseClear({x:a.x+(b.x-a.x)*t,s:a.s+(b.s-a.s)*t,y:a.y+(b.y-a.y)*t,yaw:a.yaw+yaw*t},walls))return false;}
 return true;
}
const pose=(e,y=e.y,yaw=e.yaw)=>({x:e.x,s:e.s,y,yaw});
// Stop/turn/travel/align stages keep the forward-only flight dynamics executable.
export function overheadRoute(e,goal,walls=null){
 const altitude=Math.max(SAFE_ALTITUDE,e.y,goal.y),heading=-Math.atan2(goal.x-e.x,goal.s-e.s);
 const points=[pose(e,altitude),pose(e,altitude,heading),{...goal,y:altitude,yaw:heading},{...goal,y:altitude},goal];
 let previous=pose(e);for(const p of points){if(!aircraftSweepClear(previous,p,walls))return null;previous=p;}
 return points;
}
// Bounded orientation-aware search for flying within broad corridors. Every
// edge checks the whole swept aircraft, including rotations, not a point agent.
export function corridorRoute(e,goal,walls=null){
 const start=pose(e),height=goal.y,first={...start,y:height};if(!aircraftSweepClear(start,first,walls))return null;
 const step=TACTICAL.routeStep,open=[{x:0,s:0,h:0,cost:0,pose:first,parent:null}],visited=new Map();
 const key=n=>`${n.x},${n.s},${n.h}`;
 for(let iterations=0;open.length&&iterations<TACTICAL.routeNodes;iterations++){
  open.sort((a,b)=>a.cost+Math.hypot(a.pose.x-goal.x,a.pose.s-goal.s)-b.cost-Math.hypot(b.pose.x-goal.x,b.pose.s-goal.s));
  const n=open.shift(),k=key(n);if((visited.get(k)??Infinity)<=n.cost)continue;visited.set(k,n.cost);
  if(Math.hypot(n.pose.x-goal.x,n.pose.s-goal.s)<step*1.5){
   const heading=-Math.atan2(goal.x-n.pose.x,goal.s-n.pose.s),turn={...n.pose,yaw:heading},end={...goal,yaw:heading};
   if(aircraftSweepClear(n.pose,turn,walls)&&aircraftSweepClear(turn,end,walls)&&aircraftSweepClear(end,goal,walls)){
    const path=[turn,end,goal];for(let p=n;p;p=p.parent)path.unshift(p.pose);return path;
   }
  }
  const angle=n.pose.yaw,dx=Math.round(-Math.sin(angle)*1000)/1000,ds=Math.round(Math.cos(angle)*1000)/1000;
  const choices=[{x:n.x,s:n.s,h:(n.h+1)%8,pose:{...n.pose,yaw:angle+Math.PI/4},cost:5},
   {x:n.x,s:n.s,h:(n.h+7)%8,pose:{...n.pose,yaw:angle-Math.PI/4},cost:5},
   {x:Math.round((n.x+dx)*1000)/1000,s:Math.round((n.s+ds)*1000)/1000,h:n.h,pose:{...n.pose,x:n.pose.x+dx*step,s:n.pose.s+ds*step},cost:step}];
  for(const next of choices){if(Math.hypot(next.pose.x-e.x,next.pose.s-e.s)>TACTICAL.routeRadius||!aircraftSweepClear(n.pose,next.pose,walls))continue;open.push({...next,cost:n.cost+next.cost,parent:n});}
 }
 return null;
}
