// Exact primitive intersections + Boolean boundary sweep (not sphere tracing).
// Each solid contributes surface events. The CSG expression is evaluated only
// at these boundaries, including subtraction normals and nonconvex prisms.
export const csgKernelGLSL=`
struct Event {float t;vec3 n;uint id;};
Event events[80];int eventCount;uint bits;float rangeStart,rangeEnd;
void startInside(bool inside,uint id){if(inside)bits|=1u<<id;}
void eventAt(float t,vec3 n,uint id,mat3 normalMatrix){
 if(t<=rangeStart||t>rangeEnd||eventCount>=80)return;
 events[eventCount++]=Event(t,normalize(normalMatrix*n),id);
}
void sortEvents(){for(int i=1;i<80;i++){if(i>=eventCount)break;Event e=events[i];int j=i-1;for(int k=0;k<80;k++){if(j<0)break;if(events[j].t<=e.t)break;events[j+1]=events[j];j--;}events[j+1]=e;}}
bool quadratic(float a,float b,float c,out vec2 roots){
 if(abs(a)<1e-12){if(abs(b)<1e-12)return false;roots=vec2(-c/b);return true;}
 float disc=b*b-4.*a*c;if(disc<=0.)return false;
 float q=-.5*(b+(b<0.?-1.:1.)*sqrt(disc));roots=vec2(q/a,c/q);roots=vec2(min(roots.x,roots.y),max(roots.x,roots.y));return true;
}
void sphereEvents(vec3 o,vec3 d,uint id,mat3 nm){
 vec3 start=o+d*rangeStart;startInside(dot(start,start)<1.,id);
 float dd=dot(d,d),mid=-dot(o,d)/dd;vec3 closest=o+mid*d;
 float half2=(1.-dot(closest,closest))/dd;if(half2<=0.)return;
 float delta=sqrt(half2);eventAt(mid-delta,o+(mid-delta)*d,id,nm);eventAt(mid+delta,o+(mid+delta)*d,id,nm);
}
void boxEvents(vec3 o,vec3 d,uint id,mat3 nm){
 vec3 start=o+d*rangeStart;startInside(all(lessThan(abs(start),vec3(1))),id);
 vec3 inv=1./d,a=(-vec3(1)-o)*inv,b=(vec3(1)-o)*inv,lo=min(a,b),hi=max(a,b);
 float enter=max(lo.x,max(lo.y,lo.z)),leave=min(hi.x,min(hi.y,hi.z));if(enter>=leave)return;
 vec3 en=lo.x==enter?vec3(-sign(d.x),0,0):lo.y==enter?vec3(0,-sign(d.y),0):vec3(0,0,-sign(d.z));
 vec3 ex=hi.x==leave?vec3(sign(d.x),0,0):hi.y==leave?vec3(0,sign(d.y),0):vec3(0,0,sign(d.z));
 eventAt(enter,en,id,nm);eventAt(leave,ex,id,nm);
}
void planeEvents(vec3 o,vec3 d,float x,uint id,mat3 nm){startInside(o.x+d.x*rangeStart<x,id);if(abs(d.x)>1e-10)eventAt((x-o.x)/d.x,vec3(1,0,0),id,nm);}
void coneEvents(vec3 o,vec3 d,float r0,float r1,float len,uint id,mat3 nm){
 float k=(r1-r0)/len;vec3 s=o+d*rangeStart;float r=r0+k*s.z;startInside(s.z>0.&&s.z<len&&dot(s.xy,s.xy)<r*r,id);
 vec2 roots;float rz=r0+k*o.z;
 if(quadratic(dot(d.xy,d.xy)-k*k*d.z*d.z,2.*(dot(o.xy,d.xy)-rz*k*d.z),dot(o.xy,o.xy)-rz*rz,roots)){
  for(int i=0;i<2;i++){if(i==1&&roots.x==roots.y)continue;float t=roots[i];vec3 p=o+t*d;if(p.z>0.&&p.z<len)eventAt(t,vec3(p.xy,-k*(r0+k*p.z)),id,nm);}
 }
 if(abs(d.z)>1e-10){for(int i=0;i<2;i++){float z=i==0?0.:len,rr=i==0?r0:r1,t=(z-o.z)/d.z;vec3 p=o+t*d;if(dot(p.xy,p.xy)<rr*rr)eventAt(t,vec3(0,0,i==0?-1.:1.),id,nm);}}
}
bool inPolygon(vec2 p,int count,vec2 poly[9]){bool inside=false;int j=count-1;for(int i=0;i<9;i++){if(i>=count)break;vec2 a=poly[i],b=poly[j];if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}j=i;}return inside;}
void prismEvents(vec3 o,vec3 d,int count,vec2 poly[9],float depth,uint id,mat3 nm){
 vec3 s=o+d*rangeStart;startInside(abs(s.z)<depth&&inPolygon(s.xy,count,poly),id);
 for(int i=0;i<9;i++){if(i>=count)break;vec2 a=poly[i],b=poly[(i+1)%count],edge=b-a,n=vec2(edge.y,-edge.x);float den=dot(n,d.xy);if(abs(den)<1e-10)continue;float t=dot(n,a-o.xy)/den;vec3 p=o+t*d;float along=dot(p.xy-a,edge)/dot(edge,edge);if(along>0.&&along<1.&&abs(p.z)<depth)eventAt(t,vec3(n,0),id,nm);}
 if(abs(d.z)>1e-10)for(int i=0;i<2;i++){float z=i==0?-depth:depth,t=(z-o.z)/d.z;if(inPolygon((o+t*d).xy,count,poly))eventAt(t,vec3(0,0,i==0?-1.:1.),id,nm);}
}
float cubeRoot(float x){return sign(x)*pow(abs(x),1./3.);}
float torusValue(vec3 p,float minor){float radial=length(p.xy)-1.;return radial*radial+p.z*p.z-minor*minor;}
void torusEvents(vec3 o,vec3 d,float major,float minor,uint id,mat3 nm){
 vec3 s=o+d*rangeStart;float radial=length(s.xy)-major;startInside(radial*radial+s.z*s.z<minor*minor,id);
 // Shift to closest approach and normalize by major radius before solving the
 // quartic. Its stationary points partition all roots into monotonic brackets.
 float speed=length(d),center=-dot(o,d)/(speed*speed);vec3 v=d/speed,p=(o+d*center)/major;float r=minor/major;
 float bound=(1.+r)*(1.+r)-dot(p,p);if(bound<=0.)return;float extent=sqrt(bound);
 float a2=2.*(dot(p,p)+1.-r*r)-4.*dot(v.xy,v.xy),a1=-8.*dot(p.xy,v.xy);
 float cp=a2*.5,cq=a1*.25,dis=cq*cq*.25+cp*cp*cp/27.;
 float stops[5];int count=1;stops[0]=-extent;
 if(dis>=0.){float u=cubeRoot(-cq*.5+sqrt(dis))+cubeRoot(-cq*.5-sqrt(dis));if(abs(u)<extent)stops[count++]=u;}
 else{float radius=2.*sqrt(-cp/3.),angle=acos(clamp(3.*cq/(cp*radius),-1.,1.))/3.;for(int i=0;i<3;i++){float u=radius*cos(angle-2.09439510239*float(i));if(abs(u)<extent)stops[count++]=u;}}
 stops[count++]=extent;
 for(int i=1;i<5;i++){if(i>=count)break;float u=stops[i];int j=i-1;for(int k=0;k<5;k++){if(j<0)break;if(stops[j]<=u)break;stops[j+1]=stops[j];j--;}stops[j+1]=u;}
 for(int i=0;i<4;i++){if(i+1>=count)break;float a=stops[i],b=stops[i+1],fa=torusValue(p+a*v,r),fb=torusValue(p+b*v,r);if(fa*fb>=0.)continue;
  for(int j=0;j<26;j++){float m=(a+b)*.5,f=torusValue(p+m*v,r);if((f<0.)==(fa<0.)){a=m;fa=f;}else b=m;}
  float u=(a+b)*.5,t=center+u*major/speed;vec3 q=p+u*v;eventAt(t,vec3(q.xy*(1.-1./length(q.xy)),q.z),id,nm);
 }
}
`;
