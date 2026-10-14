import {MP} from './config.js';
// Presentation contract only. Never serialize AI planning, collision grids or render history.
const CYCLE_FIELDS=['id','team','x','z','dir','alive','turns','speedMultiplier','turboCharge','boosting','brakeCharge','braking','segment','expiredTrailMeters','human','operator','reserveTurboRequested','reserveBrakeRequested','reserveReward'];
const TRAIL_FIELDS=['bikeId','team','dir','x1','z1','x2','z2','dyingAt','initial','startsRun','joining'];
const CRASH_FIELDS=['id','x','z','dir','team','time'];
const RACE_FIELDS=['round','phase','time','remaining','elapsed','winner','teamCount','cyclesPerTeam','scores'];
// 0.0001 grid cells = 0.48 mm. Simulation/collision remain full precision on the server.
const quantize=value=>typeof value==='number'?Math.round(value*10000)/10000:value;
const pick=(object,fields)=>Object.fromEntries(fields.filter(key=>object[key]!==undefined).map(key=>[key,quantize(object[key])]));
const same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);
export function projectState(state){
 return {type:'state',protocol:MP.protocol,tick:state.tick,waiting:state.waiting,clients:state.clients,
  race:{...pick(state.race,RACE_FIELDS),
   cycles:state.race.cycles.map(b=>({...pick(b,CYCLE_FIELDS),...(b.reserveReward?{reserveReward:pick(b.reserveReward,['revision','turboFrom','brakeFrom','target'])}:{})})),
   trails:state.race.trails.map(t=>pick(t,TRAIL_FIELDS)),crashes:state.race.crashes.map(c=>pick(c,CRASH_FIELDS))}};
}
function patch(next,previous={}){
 const changes={};
 for(const key of Object.keys(next))if(!same(next[key],previous[key]))changes[key]=next[key];
 const removed=Object.keys(previous).filter(key=>!(key in next));
 return [changes,removed];
}
function rows(next,previous=[]){
 const changes=[];
 for(let i=0;i<next.length;i++){
  const [values,removed]=patch(next[i],previous[i]);
  if(!previous[i]||Object.keys(values).length||removed.length)changes.push(removed.length?[i,values,removed]:[i,values]);
 }
 return [next.length,changes];
}
export function compactSnapshot(state,previous){
 if(!previous||previous.race.round!==state.race.round)return {...state,compact:true,full:true};
 const {cycles,trails,crashes,...meta}=state.race;
 const {cycles:oldCycles,trails:oldTrails,crashes:oldCrashes,...oldMeta}=previous.race;
 const packet={type:'state',protocol:MP.protocol,compact:true,full:false,tick:state.tick,baseTick:previous.tick,round:state.race.round,
  race:patch(meta,oldMeta)[0],cycles:rows(cycles,oldCycles),trails:rows(trails,oldTrails)};
 if(!same(crashes,oldCrashes))packet.crashes=crashes;
 if(!same(state.clients,previous.clients))packet.clients=state.clients;
 if(state.waiting!==previous.waiting)packet.waiting=state.waiting;
 return packet;
}
function applyRows(previous,[length,changes]){
 const result=previous.slice(0,length);
 for(const [index,values,removed=[]] of changes){
  const row={...result[index],...values};for(const key of removed)delete row[key];result[index]=row;
 }
 return result;
}
export function decodeSnapshot(packet,previous){
 if(packet.full)return packet;
 if(!previous||previous.race.round!==packet.round||previous.tick!==packet.baseTick)return null;
 return {type:'state',protocol:packet.protocol,tick:packet.tick,
  clients:packet.clients??previous.clients,waiting:packet.waiting??previous.waiting,
  race:{...previous.race,...packet.race,cycles:applyRows(previous.race.cycles,packet.cycles),
   trails:applyRows(previous.race.trails,packet.trails),crashes:packet.crashes??previous.race.crashes}};
}
