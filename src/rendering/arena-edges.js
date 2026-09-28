import * as T from 'three';

// Boolean cuts introduce T-junctions: one triangle edge may meet several
// shorter coplanar edges. EdgesGeometry cannot pair those by endpoint alone.
export function arenaEdges(geometry,threshold){
 const raw=new T.EdgesGeometry(geometry,threshold),p=raw.attributes.position;
 const groups=[],epsilon=.001;
 for(let i=0;i<p.count;i+=2){
  const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1);
  const direction=b.clone().sub(a),length=direction.length();if(length<epsilon)continue;
  direction.divideScalar(length);
  let group=groups.find(g=>Math.abs(g.direction.dot(direction))>1-1e-8&&a.clone().sub(g.origin).cross(g.direction).length()<epsilon);
  if(!group){group={origin:a.clone(),direction,intervals:[]};groups.push(group);}
  const x=a.clone().sub(group.origin).dot(group.direction),y=b.clone().sub(group.origin).dot(group.direction);
  group.intervals.push([Math.min(x,y),Math.max(x,y)]);
 }
 const output=[];
 for(const g of groups){
  const points=g.intervals.flat().sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>epsilon);
  for(let i=1;i<points.length;i++){
   const lo=points[i-1],hi=points[i],mid=(lo+hi)/2;
   // Paired overlapping boundary fragments are internal coplanar seams.
   if(g.intervals.filter(([a,b])=>mid>a-epsilon&&mid<b+epsilon).length%2===0)continue;
   for(const t of [lo,hi])output.push(...g.origin.clone().addScaledVector(g.direction,t).toArray());
  }
 }
 raw.dispose();const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(output,3));return result;
}
