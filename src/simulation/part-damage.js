import {BOSS_TANK} from '../game/boss-tank.js';
export const PART_DAMAGE=Object.freeze({normal:1,limb:.5,disableHits:2,damagedTrack:.65,disabledTrack:.25});
export function applyPartDamage(enemy,part){
 const critical=enemy.kind!=='ground'&&['crown','crossbar'].includes(part);
 const limb=part.endsWith('-leg')||part.endsWith('-track');
 const damage=enemy.kind==='ground'?(enemy.boss?Math.min(enemy.health,BOSS_TANK.normalHealth):enemy.health):critical?enemy.health:limb?PART_DAMAGE.limb:PART_DAMAGE.normal;
 enemy.health=Math.max(0,enemy.health-damage);
 if(part.endsWith('-leg')&&(enemy.partHits?.[part]||0)>=PART_DAMAGE.disableHits){
  enemy.stompDisabled=true;
  // Abort a committed strike safely into its normal climb/unfold recovery.
  if(enemy.attack){enemy.attack.phase='rise';enemy.attack.impact=false;enemy.state='recover';}
 }
 return {critical,damage};
}
export function trackMobility(enemy){
 const efficiency=part=>{const hits=enemy.partHits?.[part]||0;return hits>=PART_DAMAGE.disableHits?PART_DAMAGE.disabledTrack:hits?PART_DAMAGE.damagedTrack:1;};
 const left=efficiency('left-track'),right=efficiency('right-track');
 const disabled=left===PART_DAMAGE.disabledTrack&&right===PART_DAMAGE.disabledTrack;
 return {speed:disabled?0:Math.min(left,right),turn:disabled?0:(left+right)/2};
}
