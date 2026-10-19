// Startup-only proofs of connectivity to one common destination. Every stored
// point has a swept, collision-free route to that destination. Joining a nearby
// point is sufficient; there is no need to search the whole maze again.
export class ConnectedRouteCache {
 constructor(clear,{cellMeters=32}={}){this.clear=clear;this.cellMeters=cellMeters;this.cells=new Map();}
 add(points){
  for(const p of points){
   const key=`${Math.floor(p.x/this.cellMeters)},${Math.floor(p.s/this.cellMeters)}`;
   let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=[]);
   if(!cell.some(q=>q.x===p.x&&q.s===p.s))cell.push({x:p.x,s:p.s});
  }
 }
 connection(p){
  const size=this.cellMeters,x=Math.floor(p.x/size),s=Math.floor(p.s/size);
  for(let dx=-1;dx<=1;dx++)for(let ds=-1;ds<=1;ds++){
   for(const q of this.cells.get(`${x+dx},${s+ds}`)??[]){
    if(Math.hypot(q.x-p.x,q.s-p.s)<=size&&this.clear(p,q))return q;
   }
  }
  return null;
 }
}
