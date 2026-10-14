// Sweep against authored perimeter segments, not inflated triangulation wedges.
const closest=(p,a,b)=>{
 const dx=b.x-a.x,ds=b.s-a.s,length=dx*dx+ds*ds;
 const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.s-a.s)*ds)/length)):0;
 return {x:a.x+t*dx,s:a.s+t*ds};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.s-b.s);
const cross=(a,b,c)=>(b.x-a.x)*(c.s-a.s)-(b.s-a.s)*(c.x-a.x);
export function cycleWallContact(world,from,to,radius){
 const reach=distance(from,to)+radius;
 for(const wall of world.nearbyWalls(from.x,from.s,reach)){
  for(const edge of wall.edges){
   const {a,b}=edge,start=closest(from,a,b),end=closest(to,a,b);
   const startDistance=distance(from,start),endDistance=distance(to,end);
   // Contact must allow withdrawal, including recovery from tiny penetration.
   if(startDistance<=radius+1e-6&&endDistance>startDistance+1e-8&&!world.insideWall(wall,to.x,to.s))continue;
   const intersects=cross(from,to,a)*cross(from,to,b)<0&&cross(a,b,from)*cross(a,b,to)<0;
   const gap=intersects?0:Math.min(startDistance,endDistance,distance(a,closest(a,from,to)),distance(b,closest(b,from,to)));
   if(gap>=radius-1e-6)continue;
   const nx=from.x-start.x,ns=from.s-start.s,len=Math.hypot(nx,ns);
   return {normal:len>1e-6?{x:nx/len,z:-ns/len}:{x:edge.nx,z:-edge.ns}};
  }
  if(world.insideWall(wall,to.x,to.s))return {normal:{x:from.x-to.x,z:to.s-from.s}};
 }
 return null;
}
