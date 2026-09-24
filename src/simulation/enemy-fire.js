export const ENEMY_FIRE=Object.freeze({interval:3.4,intervalVariation:.8,yawSpread:2.4*Math.PI/180,pitchSpread:.6*Math.PI/180,speed:165});
function random(enemy){enemy.weaponSeed=(Math.imul(enemy.weaponSeed??(1982+enemy.id),1664525)+1013904223)>>>0;return enemy.weaponSeed/4294967296;}
export function enemyShot(enemy,muzzle,target){
 const dx=target.x-muzzle.x,ds=target.s-muzzle.s,dy=target.y-muzzle.y,distance=Math.hypot(dx,ds,dy);
 // Uniform disk spread gives mostly near-center shots with no systematic bias.
 const angle=random(enemy)*Math.PI*2,radius=Math.sqrt(random(enemy));
 const yaw=-Math.atan2(dx,ds)+Math.cos(angle)*radius*ENEMY_FIRE.yawSpread;
 const aimPitch=Math.atan2(dy,Math.hypot(dx,ds));
 // Level aim has horizontal spread only, matching Clu.
 const pitch=aimPitch+(Math.abs(aimPitch)>1e-8?Math.sin(angle)*radius*ENEMY_FIRE.pitchSpread:0);
 const x=-Math.sin(yaw)*Math.cos(pitch),s=Math.cos(yaw)*Math.cos(pitch),y=Math.sin(pitch);
 return {vx:x*ENEMY_FIRE.speed,vs:s*ENEMY_FIRE.speed,vy:y*ENEMY_FIRE.speed,
  target:{x:muzzle.x+x*distance,s:muzzle.s+s*distance,y:muzzle.y+y*distance},
  cooldown:ENEMY_FIRE.interval+random(enemy)*ENEMY_FIRE.intervalVariation};
}
