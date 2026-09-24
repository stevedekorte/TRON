// Surface information for the existing swept wall/floor collision, in x/y/s.
export function surfaceImpact(world,a,b){
 const wallT=world.wallIntersection(a,b);
 const floorT=b.y<0?(a.y<=0?0:a.y/(a.y-b.y)):null;
 const floor=floorT!==null&&(wallT===null||floorT<wallT),t=floor?floorT:wallT;
 if(t===null)return null;
 const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,s:a.s+(b.s-a.s)*t};
 let normal={x:0,y:1,z:0};
 if(!floor){
  let nearest=Infinity;
  for(const wall of world.nearbyWalls(point.x,point.s,.01)){
   const roof=Math.abs(point.y-wall.height);
   if(roof<nearest){nearest=roof;normal={x:0,y:1,z:0};}
   for(const edge of wall.edges){
    const dx=edge.b.x-edge.a.x,ds=edge.b.s-edge.a.s,length=dx*dx+ds*ds;
    const u=Math.max(0,Math.min(1,((point.x-edge.a.x)*dx+(point.s-edge.a.s)*ds)/length));
    const distance=Math.hypot(point.x-edge.a.x-u*dx,point.s-edge.a.s-u*ds);
    if(distance<nearest){nearest=distance;normal={x:edge.nx,y:0,z:-edge.ns};}
   }
  }
 }
 return {type:'hit',subject:'surface',...point,normal};
}
