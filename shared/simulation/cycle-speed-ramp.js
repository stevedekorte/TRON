export const GRID_SPEED=Object.freeze({intervalSeconds:15,stepMultiplier:1.1,maxMultiplier:2,rampSeconds:1,warningSeconds:3,noticeSeconds:3});
export function gridSpeedAt(seconds=0){
 const t=Math.max(0,seconds),step=Math.floor(t/GRID_SPEED.intervalSeconds);
 if(!step)return 1;
 const from=Math.min(GRID_SPEED.maxMultiplier,GRID_SPEED.stepMultiplier**(step-1)),to=Math.min(GRID_SPEED.maxMultiplier,GRID_SPEED.stepMultiplier**step);
 return from+(to-from)*Math.min(1,(t-step*GRID_SPEED.intervalSeconds)/GRID_SPEED.rampSeconds);
}
export function gridSpeedNotice(race){
 if(!race||race.phase!=='racing'||race.arenaPaused)return null;
 const t=race.elapsed??0,step=Math.floor(t/GRID_SPEED.intervalSeconds),age=t-step*GRID_SPEED.intervalSeconds;
 if(step>0&&GRID_SPEED.stepMultiplier**(step-1)<GRID_SPEED.maxMultiplier&&age<GRID_SPEED.noticeSeconds)return {key:`speed:${step}`,launch:true,text:`GRID SPEED: ${Math.round(Math.min(GRID_SPEED.maxMultiplier,GRID_SPEED.stepMultiplier**step)*100)}%`};
 if(GRID_SPEED.stepMultiplier**step>=GRID_SPEED.maxMultiplier)return null;
 const seconds=Math.ceil(GRID_SPEED.intervalSeconds-age);
 return seconds<=GRID_SPEED.warningSeconds?{key:`warning:${step}:${seconds}`,launch:false,text:`SPEED INCREASE IN ${seconds}...`}:null;
}
export function applyGridSpeed(b,multiplier){
 b.speedMultiplier=(b.speedMultiplier??1)*multiplier/(b.gridSpeedMultiplier??1);
 b.gridSpeedMultiplier=multiplier;
}
