// Constant-velocity intercept. Projectiles travel straight at a fixed speed.
export function intercept(origin,target,velocity,speed=165,maxTime=2.5){
 const r={x:target.x-origin.x,y:target.y-origin.y,s:target.s-origin.s};
 const a=velocity.x**2+velocity.y**2+velocity.s**2-speed**2;
 const b=2*(r.x*velocity.x+r.y*velocity.y+r.s*velocity.s),c=r.x**2+r.y**2+r.s**2;
 let roots=[];
 if(Math.abs(a)<1e-8){if(Math.abs(b)>1e-8)roots=[-c/b];}
 else{const d=b*b-4*a*c;if(d>=0)roots=[(-b-Math.sqrt(d))/(2*a),(-b+Math.sqrt(d))/(2*a)];}
 const time=Math.min(...roots.filter(t=>t>0&&t<=maxTime));
 return Number.isFinite(time)?{x:target.x+velocity.x*time,y:target.y+velocity.y*time,s:target.s+velocity.s*time,time}:null;
}
