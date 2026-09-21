import {GROUND_GRID_METERS} from './ground-grid.js';
import {seededRandom} from '../game/random.js';

// Maze-local coordinates become world x/s with a rigid planar transform.
export function createMazeWorld(base,seed=1982,count=4){
 const random=seededRandom(seed),floorHalf=base.FLOOR_HALF||[base.HALF,base.HALF];
 const length=Math.max(2*floorHalf[0]*Math.hypot(base.BASIS.a,base.BASIS.c),2*floorHalf[1]*Math.hypot(base.BASIS.b,base.BASIS.d));
 const sites=[[0,0],[3.3,.7],[-2.8,2.2],[.5,4.1]].slice(0,count);
 const snap=value=>Math.round(value/GROUND_GRID_METERS)*GROUND_GRID_METERS;
 const instances=sites.map(([x,s],id)=>({id,x:snap(x*length),s:snap(s*length),angle:id?Math.floor(random()*4)*Math.PI/2:0}));
 const toWorld=(p,m)=>({x:m.x+Math.cos(m.angle)*p.x-Math.sin(m.angle)*p.s,s:m.s+Math.sin(m.angle)*p.x+Math.cos(m.angle)*p.s});
 const toLocal=(p,m)=>({x:Math.cos(m.angle)*(p.x-m.x)+Math.sin(m.angle)*(p.s-m.s),s:-Math.sin(m.angle)*(p.x-m.x)+Math.cos(m.angle)*(p.s-m.s)});
 const edge=(e,m)=>({...e,a:toWorld(e.a,m),b:toWorld(e.b,m),nx:Math.cos(m.angle)*e.nx-Math.sin(m.angle)*e.ns,ns:Math.sin(m.angle)*e.nx+Math.cos(m.angle)*e.ns});
 const walls=instances.flatMap(m=>base.WALLS.map(w=>{
  const points=w.points.map(p=>toWorld(p,m));
  return {...w,id:`${m.id}:${w.id}`,mazeId:m.id,points,edges:w.edges.map(e=>edge(e,m)),triangles:w.triangles?.map(t=>t.map(e=>edge(e,m))),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minS:Math.min(...points.map(p=>p.s)),maxS:Math.max(...points.map(p=>p.s))};
 }));
 for(const m of instances){
  m.walls=walls.filter(w=>w.mazeId===m.id);
  m.bounds={minX:Math.min(...m.walls.map(w=>w.minX)),maxX:Math.max(...m.walls.map(w=>w.maxX)),minS:Math.min(...m.walls.map(w=>w.minS)),maxS:Math.max(...m.walls.map(w=>w.maxS))};
 }
 const overlaps=(w,minX,maxX,minS,maxS)=>maxX>=w.minX&&minX<=w.maxX&&maxS>=w.minS&&minS<=w.maxS;
 const openCells=instances.flatMap(m=>base.OPEN_CELLS.map(p=>({...p,...toWorld(p,m),mazeId:m.id})));
 const nearbyWalls=(x,s,r)=>instances.filter(m=>overlaps(m.bounds,x-r,x+r,s-r,s+r)).flatMap(m=>m.walls.filter(w=>overlaps(w,x-r,x+r,s-r,s+r)));
 const wallAt=(x,s)=>nearbyWalls(x,s,0).some(w=>base.insideWall(w,x,s));
 const freePosition=(x,s,r=0)=>!nearbyWalls(x,s,r).some(w=>base.insideWall(w,x,s)||base.closestWallPoint(w,x,s).distance<r);
 function wallIntersection(a,b,padding=0){
  let nearest=null;
  for(const m of instances){
   if(!overlaps(m.bounds,Math.min(a.x,b.x)-padding,Math.max(a.x,b.x)+padding,Math.min(a.s,b.s)-padding,Math.max(a.s,b.s)+padding))continue;
   const hit=base.wallIntersection({...a,...toLocal(a,m)},{...b,...toLocal(b,m)},padding);
   if(hit!==null&&(nearest===null||hit<nearest))nearest=hit;
  }
  return nearest;
 }
 return {instances,walls,openCells,toWorld,toLocal,nearbyWalls,wallAt,freePosition,wallIntersection,lineOfSight:(a,b)=>wallIntersection(a,b)===null};
}
