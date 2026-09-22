import {worldFor,DEFAULT_WORLD,attachWorld} from '../levels/scenario.js';
import {cannonPose} from './run.js';
import {CLU_WEAPON,RECOGNIZER_SCALE} from '../game/config.js';
import {enemyHitPart} from './hit-parts.js';
// Predict the current barrel's shot, not an auto-aim correction. Enemy motion is
// extrapolated linearly; turns, acceleration and changing folds can invalidate it.
export function gunnerSolution(run){
 const {wallIntersection,lineOfSight}=worldFor(run);
 if(!run.gunner||run.crushed)return null;
 const muzzle=cannonPose(run),pitch=run.aimPitch||0;
 if(!lineOfSight({x:run.x,s:run.s,y:muzzle.y},muzzle))return null;
 const velocity={x:-Math.sin(muzzle.yaw)*Math.cos(pitch)*CLU_WEAPON.speed,s:Math.cos(muzzle.yaw)*Math.cos(pitch)*CLU_WEAPON.speed,y:Math.sin(pitch)*CLU_WEAPON.speed};
 const end={x:muzzle.x+velocity.x*CLU_WEAPON.lifetime,s:muzzle.s+velocity.s*CLU_WEAPON.lifetime,y:muzzle.y+velocity.y*CLU_WEAPON.lifetime};
 const obstruction=wallIntersection(muzzle,end),limit=CLU_WEAPON.lifetime*(obstruction??1);
 let best=null;
 for(const enemy of [...run.recognizers,...run.enemyTanks]){
  if(enemy.state==='destroyed'||!lineOfSight(muzzle,{x:enemy.x,s:enemy.s,y:enemy.kind==='ground'?2.3:enemy.y}))continue;
  const radius=enemy.kind==='ground'?8:Math.hypot(18,22)*RECOGNIZER_SCALE;
  const relative={x:velocity.x-(enemy.vx||0),s:velocity.s-(enemy.vs||0),y:velocity.y-(enemy.vy||0)};
  const offset={x:muzzle.x-enemy.x,s:muzzle.s-enemy.s,y:muzzle.y-(enemy.kind==='ground'?1.4:enemy.y)};
  const speed2=relative.x**2+relative.s**2+relative.y**2;
  if(speed2<1e-8)continue;
  const center=-(offset.x*relative.x+offset.s*relative.s+offset.y*relative.y)/speed2;
  const closest2=(offset.x+relative.x*center)**2+(offset.s+relative.s*center)**2+(offset.y+relative.y*center)**2;
  if(closest2>radius*radius)continue;
  const half=Math.sqrt((radius*radius-closest2)/speed2),stop=Math.min(center+half,limit,best?.time??Infinity),step=.5/Math.sqrt(speed2);
  for(let t=Math.max(0,center-half);t<=stop;t+=step){
   const point={x:muzzle.x+velocity.x*t,s:muzzle.s+velocity.s*t,y:muzzle.y+velocity.y*t};
   const predicted={...enemy,x:enemy.x+(enemy.vx||0)*t,s:enemy.s+(enemy.vs||0)*t,y:enemy.y+(enemy.vy||0)*t};
   const part=enemyHitPart(predicted,point);
   if(part){best={id:enemy.id,part,time:t,point,critical:enemy.kind!=='ground'&&part==='crown'};break;}
  }
 }
 return best;
}
