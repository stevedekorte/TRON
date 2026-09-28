import {cannonTarget,cannonPose} from '../simulation/run.js';
import {RECOGNIZER_SCALE} from '../game/config.js';
export const ASSIST_MARKER=Object.freeze({crownHeightMeters:8*RECOGNIZER_SCALE,gapMeters:3,flashPeriodMilliseconds:200,flashCount:3,opacity:.5});
export function assistedRecognizerTarget(run){
 if(run.playerVehicle==='cycle'||run.gunner||run.crushed||run.won)return null;
 const aim=cannonTarget(run);
 if(!aim.lock||aim.y<=cannonPose(run).y)return null;
 const enemy=run.recognizers.find(e=>e.id===aim.id);
 return enemy?{id:enemy.id,x:enemy.x,s:enemy.s,y:enemy.y+ASSIST_MARKER.crownHeightMeters+ASSIST_MARKER.gapMeters}:null;
}
