export const CLU_DEATH_CAMERA=Object.freeze({holdSeconds:8,transitionSeconds:4});
export function livingCluKiller(run){
 if(!run.crushed||run.playerVehicle==='cycle'||run.killedBy==null)return null;
 return [...(run.enemyTanks??[]),...(run.recognizers??[])].find(e=>e.id===run.killedBy&&e.health>0&&e.state!=='destroyed')??null;
}
