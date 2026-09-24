import {GROUND_GRID_METERS} from './ground-grid.js';
import {seededRandom} from '../game/random.js';

// Maze-local coordinates become world x/s with a rigid planar transform.
export function createMazeWorld(base,seed=1982,count=4,central=null){
 const random=seededRandom(seed),floorHalf=base.FLOOR_HALF||[base.HALF,base.HALF];
 const length=Math.max(2*floorHalf[0]*Math.hypot(base.BASIS.a,base.BASIS.c),2*floorHalf[1]*Math.hypot(base.BASIS.b,base.BASIS.d));
 const sites=[[0,0],[3.3,.7],[-2.8,2.2],[.5,4.1]].slice(0,count);
 const snap=value=>Math.round(value/GROUND_GRID_METERS)*GROUND_GRID_METERS;
 const instances=sites.map(([x,s],id)=>({id,x:snap(x*length),s:snap(s*length),angle:id?Math.floor(random()*4)*Math.PI/2:0}));
 if(central){
  const center={id:instances.length,x:snap(instances.reduce((v,m)=>v+m.x,0)/instances.length),s:snap(instances.reduce((v,m)=>v+m.s,0)/instances.length),angle:0,kind:'labyrinth'};
  const gap=12*GROUND_GRID_METERS;
  for(const m of instances){
   const hw=Math.abs(Math.cos(m.angle))*floorHalf[0]+Math.abs(Math.sin(m.angle))*floorHalf[1],hh=Math.abs(Math.sin(m.angle))*floorHalf[0]+Math.abs(Math.cos(m.angle))*floorHalf[1];
   const dx=m.x-center.x,ds=m.s-center.s,length=Math.hypot(dx,ds)||1;
   for(let n=0;n<1000&&Math.abs(m.x-center.x)<hw+central.FLOOR_HALF[0]+gap&&Math.abs(m.s-center.s)<hh+central.FLOOR_HALF[1]+gap;n++){m.x=snap(m.x+dx/length*GROUND_GRID_METERS*2);m.s=snap(m.s+ds/length*GROUND_GRID_METERS*2);}
  }
  instances.push(center);
 }
 const source=m=>m.kind==='labyrinth'?central:base;
 for(const m of instances){m.floorHalf=source(m).FLOOR_HALF||[source(m).HALF,source(m).HALF];m.basis=source(m).BASIS;}
 const toWorld=(p,m)=>({x:m.x+Math.cos(m.angle)*p.x-Math.sin(m.angle)*p.s,s:m.s+Math.sin(m.angle)*p.x+Math.cos(m.angle)*p.s});
 const toLocal=(p,m)=>({x:Math.cos(m.angle)*(p.x-m.x)+Math.sin(m.angle)*(p.s-m.s),s:-Math.sin(m.angle)*(p.x-m.x)+Math.cos(m.angle)*(p.s-m.s)});
 for(const m of instances){if(source(m).BEAM_POSITION)m.beamPosition=toWorld(source(m).BEAM_POSITION,m);m.patrols=source(m).PATROLS;}
 const edge=(e,m)=>({...e,a:toWorld(e.a,m),b:toWorld(e.b,m),nx:Math.cos(m.angle)*e.nx-Math.sin(m.angle)*e.ns,ns:Math.sin(m.angle)*e.nx+Math.cos(m.angle)*e.ns});
 const walls=instances.flatMap(m=>source(m).WALLS.map(w=>{
  const points=w.points.map(p=>toWorld(p,m));
  return {...w,id:`${m.id}:${w.id}`,mazeId:m.id,points,holes:w.holes?.map(ring=>ring.map(p=>toWorld(p,m))),edges:w.edges.map(e=>edge(e,m)),triangles:w.triangles?.map(t=>t.map(e=>edge(e,m))),minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minS:Math.min(...points.map(p=>p.s)),maxS:Math.max(...points.map(p=>p.s))};
 }));
 for(const m of instances){
  m.walls=walls.filter(w=>w.mazeId===m.id);
  m.bounds={minX:Math.min(...m.walls.map(w=>w.minX)),maxX:Math.max(...m.walls.map(w=>w.maxX)),minS:Math.min(...m.walls.map(w=>w.minS)),maxS:Math.max(...m.walls.map(w=>w.maxS))};
 }
 const overlaps=(w,minX,maxX,minS,maxS)=>maxX>=w.minX&&minX<=w.maxX&&maxS>=w.minS&&minS<=w.maxS;
 const openCells=instances.flatMap(m=>source(m).OPEN_CELLS.map(p=>({...p,...toWorld(p,m),mazeId:m.id})));
 const nearbyWalls=(x,s,r)=>instances.filter(m=>overlaps(m.bounds,x-r,x+r,s-r,s+r)).flatMap(m=>m.walls.filter(w=>overlaps(w,x-r,x+r,s-r,s+r)));
 const insideWall=(w,x,s)=>source(instances[w.mazeId]).insideWall(w,x,s);
 const closestWallPoint=(w,x,s)=>source(instances[w.mazeId]).closestWallPoint(w,x,s);
 const wallAt=(x,s)=>nearbyWalls(x,s,0).some(w=>insideWall(w,x,s));
 const freePosition=(x,s,r=0)=>!nearbyWalls(x,s,r).some(w=>insideWall(w,x,s)||closestWallPoint(w,x,s).distance<r);
 function wallIntersection(a,b,padding=0){
  let nearest=null;
  for(const m of instances){
   if(!overlaps(m.bounds,Math.min(a.x,b.x)-padding,Math.max(a.x,b.x)+padding,Math.min(a.s,b.s)-padding,Math.max(a.s,b.s)+padding))continue;
   const hit=source(m).wallIntersection({...a,...toLocal(a,m)},{...b,...toLocal(b,m)},padding);
   if(hit!==null&&(nearest===null||hit<nearest))nearest=hit;
  }
  return nearest;
 }
 return {insideWall,closestWallPoint,instances,walls,openCells,toWorld,toLocal,nearbyWalls,wallAt,freePosition,wallIntersection,lineOfSight:(a,b)=>wallIntersection(a,b)===null};
}
