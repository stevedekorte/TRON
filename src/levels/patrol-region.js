// Interior annular sectors spread the large labyrinth patrols among its passages.
export function inPatrolRegion(p,m,sector=null,count=1){
 if(!m.patrols)return true;
 const center=m.beamPosition??m,dx=(p.x-center.x)/m.floorHalf[0],ds=(p.s-center.s)/m.floorHalf[1];
 const radius=Math.hypot(dx,ds);
 if(radius<m.patrols.innerRadiusFraction||radius>m.patrols.outerRadiusFraction)return false;
 const angle=(Math.atan2(ds,dx)+Math.PI*2)%(Math.PI*2);
 return sector===null||Math.floor(angle/(Math.PI*2)*count)===sector;
}
