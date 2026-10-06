// Convex polygons use counterclockwise winding in wall-local coordinates.
const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
export const contains=(polygon,p)=>polygon.every((a,i)=>cross(a,polygon[(i+1)%polygon.length],p)>=-1e-8);
function clip(polygon,a,b,inside){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,p),dq=cross(a,b,q);
  const pin=inside?dp>=0:dp<=0,qin=inside?dq>=0:dq<=0;
  if(pin)out.push(p);
  if(pin!==qin){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
 }
 return out;
}
export function subtract(polygon,cutter){
 // Avoid subdividing distant faces along the infinite extensions of cut edges.
 const separated=(a,b)=>a.some((p,i)=>b.every(q=>cross(p,a[(i+1)%a.length],q)<=1e-9));
 if(separated(polygon,cutter)||separated(cutter,polygon))return [polygon];
 const pieces=[];let remaining=polygon;
 for(let i=0;i<cutter.length&&remaining.length>=3;i++){
  const a=cutter[i],b=cutter[(i+1)%cutter.length],outside=clip(remaining,a,b,false);
  if(outside.length>=3)pieces.push(outside);
  remaining=clip(remaining,a,b,true);
 }
 return pieces;
}
export function subtractAll(polygons,cutters){
 for(const cutter of cutters)polygons=polygons.flatMap(p=>subtract(p,cutter));
 return polygons;
}
export function edgeCuts(a,b,polygons){
 const cuts=[0,1],dx=b.x-a.x,dy=b.y-a.y;
 for(const polygon of polygons)for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],ex=q.x-p.x,ey=q.y-p.y,den=dx*ey-dy*ex;
  if(Math.abs(den)<1e-9)continue;
  const px=p.x-a.x,py=p.y-a.y,t=(px*ey-py*ex)/den,u=(px*dy-py*dx)/den;
  if(t>1e-8&&t<1-1e-8&&u>=0&&u<=1)cuts.push(t);
 }
 return [...new Set(cuts)].sort((a,b)=>a-b);
}
