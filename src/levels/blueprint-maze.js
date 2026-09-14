import {ShapeUtils,Vector2} from 'three';
import {OUTLINES,BLUEPRINT_SIZE,METERS_PER_PIXEL} from './blueprint-outlines.js';
export const WALL_HEIGHT=54;
export const HALF=BLUEPRINT_SIZE[0]*METERS_PER_PIXEL/2;
export const FLOOR_HALF=[HALF,BLUEPRINT_SIZE[1]*METERS_PER_PIXEL/2];
export const SIZE=48,CELL=HALF*2/SIZE;
export const BASIS=Object.freeze({a:1,b:0,c:0,d:1});
export const gridToWorld=(u,v)=>({x:u,s:v});
export const worldToGrid=(x,s)=>({u:x,v:s});
export const pixelToWorld=([x,y])=>({x:(x-BLUEPRINT_SIZE[0]/2)*METERS_PER_PIXEL,s:(BLUEPRINT_SIZE[1]/2-y)*METERS_PER_PIXEL});
// Start one full maze width beyond its southern edge, aligned with the entrance.
export const SPAWN={x:pixelToWorld([1288,980]).x,s:-FLOOR_HALF[1]-2*HALF,yaw:0};
export const RECOGNIZER_STARTS=[[-80,150],[1752,230],[-80,800],[1752,850],[830,-90]].map(pixelToWorld);
export function cellAt(x,s){return {c:Math.floor((x+HALF)/CELL),r:Math.floor((s+HALF)/CELL)};}
export function cellCenter(c,r){return {x:(c+.5)*CELL-HALF,s:(r+.5)*CELL-HALF};}
function edges(points){return points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,ds=b.s-a.s,len=Math.hypot(dx,ds);return {a,b,nx:ds/len,ns:-dx/len};});}
export const WALLS=OUTLINES.map((outline,id)=>{
 let points=outline.map(pixelToWorld);
 const area=points.reduce((v,p,i)=>{const q=points[(i+1)%points.length];return v+p.x*q.s-q.x*p.s;},0);
 if(area<0)points.reverse();
 const triangles=ShapeUtils.triangulateShape(points.map(p=>new Vector2(p.x,p.s)),[]).map(t=>edges(t.map(i=>points[i])));
 return {id,c:id,r:0,points,edges:edges(points),triangles,height:WALL_HEIGHT,
 minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minS:Math.min(...points.map(p=>p.s)),maxS:Math.max(...points.map(p=>p.s))};
});
export function insideWall(w,x,s){
 let inside=false;
 for(const {a,b,nx,ns} of w.edges){
  if(Math.abs((x-a.x)*nx+(s-a.s)*ns)<1e-8&&(x-a.x)*(x-b.x)+(s-a.s)*(s-b.s)<=1e-8)return true;
  if((a.s>s)!==(b.s>s)&&x<(b.x-a.x)*(s-a.s)/(b.s-a.s)+a.x)inside=!inside;
 }
 return inside;
}
export function nearbyWalls(x,s,radius){return WALLS.filter(w=>x+radius>=w.minX&&x-radius<=w.maxX&&s+radius>=w.minS&&s-radius<=w.maxS);}
export const wallAt=(x,s)=>nearbyWalls(x,s,0).some(w=>insideWall(w,x,s));
export function closestWallPoint(w,x,s){
 let best=null;
 for(const edge of w.edges){const {a,b}=edge,dx=b.x-a.x,ds=b.s-a.s,t=Math.max(0,Math.min(1,((x-a.x)*dx+(s-a.s)*ds)/(dx*dx+ds*ds)));
 const px=a.x+t*dx,ps=a.s+t*ds,distance=Math.hypot(x-px,s-ps);
 if(!best||distance<best.distance)best={x:px,s:ps,distance,nx:edge.nx,ns:edge.ns};}
 return best;
}
export const freePosition=(x,s,radius=0)=>!nearbyWalls(x,s,radius).some(w=>insideWall(w,x,s)||closestWallPoint(w,x,s).distance<radius);
export const GRID=Array.from({length:SIZE},(_,r)=>Array.from({length:SIZE},(_,c)=>{const p=cellCenter(c,r);return wallAt(p.x,p.s)?1:0;}));
export const solidCell=(c,r)=>GRID[r]?.[c]===1;
export const OPEN_CELLS=[];
for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const p=cellCenter(c,r);if(Math.abs(p.s)<FLOOR_HALF[1]&&freePosition(p.x,p.s,4))OPEN_CELLS.push({...p,c,r});}
// Concave wall outlines retain their perimeter for driving. Their triangulation
// is used only for segment/prism clipping, so notches remain open to sight/fire.
export function wallIntersection(a,b,padding=0){
 if(Math.min(a.y,b.y)>WALL_HEIGHT+padding)return null;
 let nearest=null;
 for(const w of WALLS){
 if(Math.max(a.x,b.x)<w.minX-padding||Math.min(a.x,b.x)>w.maxX+padding||Math.max(a.s,b.s)<w.minS-padding||Math.min(a.s,b.s)>w.maxS+padding)continue;
 for(const triangle of w.triangles){
 let enter=0,leave=1;
 const clip=(start,delta,limit)=>{if(Math.abs(delta)<1e-10){if(start>limit)enter=2;return;}const t=(limit-start)/delta;if(delta<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);};
 clip(a.y,b.y-a.y,WALL_HEIGHT+padding);clip(-a.y,a.y-b.y,1);
 for(const e of triangle)clip((a.x-e.a.x)*e.nx+(a.s-e.a.s)*e.ns,(b.x-a.x)*e.nx+(b.s-a.s)*e.ns,padding);
 if(enter<=leave&&leave>=0&&enter<=1&&(nearest===null||enter<nearest))nearest=Math.max(0,enter);
 }}
 return nearest;
}
export const lineOfSight=(a,b)=>wallIntersection(a,b)===null;
