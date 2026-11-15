// Add one percent of initial speed per second, smoothly, up to 4x initial speed (reached at 300 seconds).
export const GRID_SPEED=Object.freeze({increasePerSecond:.01,maxMultiplier:4});
export function gridSpeedAt(seconds=0){
 return Math.min(GRID_SPEED.maxMultiplier,1+Math.max(0,seconds)*GRID_SPEED.increasePerSecond);
}
export function gridSpeedNotice(race){
 if(!race)return null;
 return {text:`GRID SPEED: ${Math.floor(gridSpeedAt(race.elapsed??0)*100+1e-8)}%`};
}
export function applyGridSpeed(b,multiplier){
 b.speedMultiplier=(b.speedMultiplier??1)*multiplier/(b.gridSpeedMultiplier??1);
 b.gridSpeedMultiplier=multiplier;
}
