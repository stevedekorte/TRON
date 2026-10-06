export const CLU_DEATH_CAMERA=Object.freeze({holdSeconds:4,transitionSeconds:2});
export function livingCluKiller(run){
 if(!run.crushed||run.playerVehicle==='cycle'||run.killedBy==null)return null;
 return [...(run.enemyTanks??[]),...(run.recognizers??[])].find(e=>e.id===run.killedBy&&e.health>0&&e.state!=='destroyed')??null;
}
