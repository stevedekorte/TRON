import {Vector3} from 'three';
import {ARENA_WALL} from '../game/arena-breaches.js';
import {breachVolumes} from './arena-breaches.js';
import {CAMERA_CLEARANCE} from './camera-collision.js';

export const ARENA_CAMERA_WALL_HEIGHT=60;
export function cycleCameraAnchor(pose,race,height,radius){
 const anchor=new Vector3(pose.x,height,-pose.s),site=race.site;
 const x=anchor.x-site.x,z=anchor.z+site.s;
 // The bike can fit closer to a wall than the camera's padded volume.
 // Keep the raised anchor on the arena side rather than inside that padding.
 if(Math.abs(x)<=ARENA_WALL.innerMeters&&Math.abs(z)<=ARENA_WALL.innerMeters){
  const limit=ARENA_WALL.innerMeters-radius-CAMERA_CLEARANCE.contactMarginMeters;
  anchor.x=site.x+Math.max(-limit,Math.min(limit,x));
  anchor.z=-site.s+Math.max(-limit,Math.min(limit,z));
 }
 return anchor;
}
const breachCache=new WeakMap();
function interval(a,b,planes,padding=0){
 let enter=0,leave=1;
 for(const [n,d] of planes){
  const start=n.dot(a)-d-padding,delta=n.dot(b)-n.dot(a);
  if(Math.abs(delta)<1e-10){if(start>0)return null;continue;}
  const t=-start/delta;
  if(delta<0)enter=Math.max(enter,t);else leave=Math.min(leave,t);
  if(enter>leave)return null;
 }
 return [enter,leave];
}
const box=(min,max)=>[
 [new Vector3(1,0,0),max.x],[new Vector3(-1,0,0),-min.x],
 [new Vector3(0,1,0),max.y],[new Vector3(0,-1,0),-min.y],
 [new Vector3(0,0,1),max.z],[new Vector3(0,0,-1),-min.z],
];
const {innerMeters:inner,outerMeters:outer}=ARENA_WALL;
const walls=[];
for(const axis of ['x','z'])for(const sign of [-1,1]){
 const min=new Vector3(-outer,0,-outer),max=new Vector3(outer,ARENA_CAMERA_WALL_HEIGHT,outer);
 min[axis]=sign<0?-outer:inner;max[axis]=sign<0?-inner:outer;
 walls.push({axis,sign,planes:box(min,max)});
}

// Collision prisms are independent of the decorative mesh. Breach openings
// use the same authored profile, so the camera can follow a cycle through.
export function arenaCameraIntersection(race,a,b,radius=0){
 if(!race?.site)return null;
 const local=p=>new Vector3(p.x-race.site.x,p.y,-p.s+race.site.s);
 const start=local(a),end=local(b),breaches=race.breaches??[];
 let cached=breachCache.get(breaches);
 if(!cached||cached.count!==breaches.length){cached={count:breaches.length,holes:breaches.map(b=>({axis:b.axis,sign:b.sign,volumes:breachVolumes(b,[ARENA_WALL.profile])}))};breachCache.set(breaches,cached);}
 let nearest=null;
 for(const wall of walls){
  const hit=interval(start,end,wall.planes,radius);if(!hit)continue;
  const holes=[];
  for(const hole of cached.holes){
   if(hole.axis!==wall.axis||hole.sign!==wall.sign)continue;
   for(const volume of hole.volumes){
    const planes=volume.map(([n,d],i)=>[n,i<2?d+radius:i<4?d:d-radius*n.length()]);
    const cut=interval(start,end,planes);if(cut)holes.push(cut);
   }
  }
  let t=hit[0];
  for(const [from,to] of holes.sort((a,b)=>a[0]-b[0])){if(from>t+1e-9)break;if(to>=t)t=to+1e-9;}
  if(t<=hit[1]&&(nearest===null||t<nearest))nearest=t;
 }
 return nearest;
}
export function cycleCameraWorld(world,race){return {
 WALL_HEIGHT:Math.max(world.WALL_HEIGHT??0,ARENA_CAMERA_WALL_HEIGHT),
 wallIntersection(a,b,radius=0){
  const maze=world.wallIntersection?.(a,b,radius)??null,arena=arenaCameraIntersection(race,a,b,radius);
  return maze===null?arena:arena===null?maze:Math.min(maze,arena);
 },
};}
