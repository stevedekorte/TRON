import {RECOGNIZER_SCALE} from '../game/config.js';
// Collision regions, independent of rendering. Preserve the existing hit volumes.
// Tank subdivisions are approximate armor zones, not triangle-level model hits.
export function enemyHitPart(enemy,point){
 const dx=point.x-enemy.x,dz=-(point.s-enemy.s);
 const x=Math.cos(enemy.yaw)*dx-Math.sin(enemy.yaw)*dz;
 if(enemy.kind==='ground'){
  if(Math.hypot(dx,dz)>=3.5||point.y>=3.5)return null;
  if(point.y>=1.8)return 'turret';
  if(Math.abs(x)>2.2)return x<0?'left-track':'right-track';
  return 'hull';
 }
 const lx=x/RECOGNIZER_SCALE,lz=(Math.sin(enemy.yaw)*dx+Math.cos(enemy.yaw)*dz)/RECOGNIZER_SCALE,ly=(point.y-enemy.y)/RECOGNIZER_SCALE;
 if(Math.abs(lz)>=4.35)return null;
 const hull=Math.abs(lx)<18&&ly>-4&&ly<5,crown=Math.abs(lx)<7&&ly>=5&&ly<8;
 if(hull||crown)return Math.abs(lx)>9?(lx<0?'left-shoulder':'right-shoulder'):(ly>1?'crown':'crossbar');
 const legX=Math.abs(lx)+(enemy.fold||0)*13;
 return legX>10&&legX<17&&ly>-22&&ly<=-4?(lx<0?'left-leg':'right-leg'):null;
}
export function recordEnemyHit(enemy,point,part,time){
 enemy.lastHit={part,time,x:point.x,y:point.y,s:point.s};
 enemy.partHits??={};enemy.partHits[part]=(enemy.partHits[part]||0)+1;
}
