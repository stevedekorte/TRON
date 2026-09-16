import {RECOGNIZER_STARTS as mazeStarts} from '../levels/maze.js';
import {AIR_ESCORT_COUNT,airEscortSlot} from './carrier.js';
export const RECOGNIZER_STARTS=[...mazeStarts.map((p,i)=>({...p,role:i<2?'pursuer':'patrol'})),...Array.from({length:AIR_ESCORT_COUNT},(_,escortIndex)=>({...airEscortSlot(escortIndex,0),role:'escort',escortIndex}))];
