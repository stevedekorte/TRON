import {MP} from './config.js';
import {resetCycleRound,updateCycleRace} from '../../src/simulation/light-cycles.js';

// Transport-independent authority. Only this object decides seats, movement and deaths.
export class CycleRoom{
 constructor({seed=1982}={}){
  this.seed=seed>>>0;this.tick=0;this.clients=new Map();this.queue=[];this.serial=0;
  this.race={site:{x:0,s:0},seed:this.seed,round:0,scores:[0,0,0,0],time:0,
   closedArena:true,startWithBreach:false,hideMiddleOpponent:false};
  this.nextRound();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 shuffle(values){for(let i=values.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;}
 join(id){
  if(this.clients.has(id)||this.clients.size>=MP.maxConnections)return false;
  this.clients.set(id,{id,label:`USER ${++this.serial}`,seat:null,seq:0,ack:0,inputs:[],control:{turbo:false,brake:false},lastInputTick:this.tick,lastTurnTick:-Infinity});
  this.queue.push(id);if(this.race.phase==='countdown'){
   if(this.clients.size>this.race.cycles.length&&this.race.cycles.length<MP.maxPlayers){
    const remaining=this.race.remaining;this.nextRound();this.race.remaining=remaining;
   }else this.fillSeats();
  }return true;
 }
 leave(id){
  const client=this.clients.get(id);if(!client)return;
  const bike=this.race.cycles[client.seat];
  if(bike&&this.race.phase==='countdown'){delete bike.human;delete bike.operator;}
  else if(bike?.alive){bike.alive=false;this.race.crashes.push({id:bike.id,x:bike.x,z:bike.z,dir:bike.dir,team:bike.team,time:this.race.time});}
  this.clients.delete(id);this.queue=this.queue.filter(x=>x!==id);
  if(this.race.phase==='countdown')this.fillSeats();
 }
 fillSeats(){
  const occupied=new Set([...this.clients.values()].map(c=>c.seat).filter(x=>x!==null));
  const free=this.shuffle(this.race.cycles.filter(b=>!occupied.has(b.id)).map(b=>b.id));
  while(this.queue.length&&free.length){
   const client=this.clients.get(this.queue.shift());if(!client)continue;
   client.seat=free.pop();client.inputs=[];client.control={turbo:false,brake:false};client.lastTurnTick=-Infinity;
   Object.assign(this.race.cycles[client.seat],{human:true,operator:client.label});
  }
 }
 nextRound(){
  const survivors=[...this.clients.values()].filter(c=>c.seat!==null&&this.race.cycles?.[c.seat]?.alive);
  for(const c of this.clients.values()){
   if(!survivors.includes(c)&&!this.queue.includes(c.id))this.queue.push(c.id);
   c.seat=null;c.inputs=[];c.control={turbo:false,brake:false};
  }
  const minimumTeams=Math.max(2,Math.ceil(Math.min(MP.maxPlayers,this.clients.size)/MP.maxCyclesPerTeam));
  const available=[2,3,4].filter(n=>n>=minimumTeams);
  const counts=available.length>1?available.filter(n=>n!==this.race.teamCount):available;
  this.race.teamCount=counts[Math.floor(this.random()*counts.length)];
  this.race.cyclesPerTeam=MP.maxCyclesPerTeam;this.race.breaches=[];
  resetCycleRound(this.race);this.race.remaining=MP.countdownSeconds;
  // Survivors keep seats, but get a new randomly assigned team/slot.
  this.queue=[...this.shuffle(survivors.map(c=>c.id)),...this.queue.filter(id=>!survivors.some(c=>c.id===id))];
  this.fillSeats();
 }
 restart(id,round){
  // Count every connected human, including spectators: nobody may reset a shared match.
  if(this.clients.size!==1||!this.clients.has(id)||round!==this.race.round)return false;
  this.nextRound();
  if(!this.queue.length){this.race.remaining=0;updateCycleRace(this.race,0);}
  return true;
 }
 input(id,message){
  const c=this.clients.get(id);
  if(!c||message.round!==this.race.round||!Number.isSafeInteger(message.seq)||message.seq<=c.seq||
   !Number.isSafeInteger(message.tick)||message.tick<this.tick-MP.maxLateTicks||message.tick>this.tick+MP.maxFutureTicks||
   ![-1,0,1].includes(message.turn)||typeof message.turbo!=='boolean'||typeof message.brake!=='boolean')return false;
  c.seq=message.seq;
  if(c.seat===null||!this.race.cycles[c.seat]?.alive||this.race.phase!=='racing'){c.ack=message.seq;return false;}
  if(c.inputs.length>=16)return false;
  // No client can backdate a collision. Late inputs apply on the next tick.
  const at=Math.max(this.tick+1,message.tick,c.inputs.at(-1)?.at??0);
  c.inputs.push({...message,at});return true;
 }
 step(){
  if(!this.clients.size)return;
  this.tick++;
  if(this.race.phase==='result'){
   this.race.time+=1/MP.tickHz;this.race.remaining-=1/MP.tickHz;
   if(this.race.remaining<=0)this.nextRound();return;
  }
  const controls=new Map();
  for(const c of this.clients.values()){
   let turn=0;
   while(c.inputs.length&&c.inputs[0].at<=this.tick){
    const m=c.inputs.shift();c.ack=m.seq;c.lastInputTick=this.tick;
    c.control={turbo:m.turbo,brake:m.brake};
    if(m.turn&&!turn&&this.tick-c.lastTurnTick>=MP.turnIntervalTicks){turn=m.turn;c.lastTurnTick=this.tick;}
   }
   if(this.tick-c.lastInputTick>MP.inputTimeoutTicks)c.control={turbo:false,brake:false};
   if(c.seat!==null)controls.set(c.seat,{...c.control,turn});
  }
  updateCycleRace(this.race,1/MP.tickHz,0,false,false,{},controls);
  for(const c of this.clients.values())if(c.seat!==null&&!this.race.cycles[c.seat].alive&&!this.queue.includes(c.id))this.queue.push(c.id);
  if(this.race.phase==='racing'&&(this.race.elapsed>=MP.maxMatchSeconds||this.race.trails.length>=MP.maxTrails)){
   this.race.phase='result';this.race.winner=null;this.race.remaining=MP.resultSeconds;
  }
 }
 state(){
  const {occupied,outerOccupied,pendingTurns,...race}=this.race;
  return structuredClone({type:'state',protocol:MP.protocol,tick:this.tick,race,
   clients:[...this.clients.values()].map(c=>({id:c.id,label:c.label,seat:c.seat,ack:c.ack,queue:this.queue.indexOf(c.id)+1})),waiting:this.queue.length});
 }
}

// Trail deltas avoid retransmitting the growing history at every snapshot.
export function wireState(state,previous){
 const {trails,...race}=state.race;
 if(!previous||previous.race.round!==race.round)return {...state,full:true};
 const changed=[];for(let i=0;i<trails.length;i++)if(JSON.stringify(trails[i])!==JSON.stringify(previous.race.trails[i]))changed.push([i,trails[i]]);
 return {...state,race,trailLength:trails.length,trailChanges:changed,full:false};
}
