import {MP} from './config.js';
import {resetCycleRound,updateCycleRace} from '../simulation/light-cycles.js';

/**
 * Whether connected human `id` may start a new match. A sole connected human
 * always may. Otherwise any connected human (seated or waiting) may once no
 * seated human's cycle is alive, so nobody's live run is reset. Shared by the
 * server authority and client prompts. `clients`: [{id,seat}].
 */
export function restartAllowed(race,clients,id){
 if(!race?.cycles||!clients.some(c=>c.id===id))return false;
 if(clients.filter(c=>!c.disconnected).length===1)return true;
 // A disconnected rider's cycle runs on unattended and never blocks a restart.
 return !clients.some(c=>!c.disconnected&&c.seat!==null&&c.seat!==undefined&&race.cycles[c.seat]?.alive);
}

// Transport-independent authority. Only this object decides seats, movement and deaths.
export class CycleRoom{
 constructor({seed=1982}={}){
  this.seed=seed>>>0;this.tick=0;this.clients=new Map();this.queue=[];this.serial=0;
  this.race={site:{x:0,s:0},seed:this.seed,round:0,scores:[0,0,0,0],time:0,
   closedArena:true,derezOnEscape:true,formationSpacingCells:MP.startFormationSpacingCells,aiMode:'bounded',startWithBreach:false,hideMiddleOpponent:false};
  this.nextRound();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 shuffle(values){for(let i=values.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;}
 join(id){
  if(this.clients.has(id)||this.connectedCount()>=MP.maxConnections)return false;
  this.clients.set(id,{id,label:`USER ${++this.serial}`,seat:null,seq:0,ack:0,inputs:[],control:{turbo:false,brake:false},lastInputTick:this.tick,lastTurnTick:-Infinity});
  this.queue.push(id);if(this.race.phase==='countdown'&&this.race.cameraStaging){
   if(this.clients.size>this.race.cycles.length&&this.race.cycles.length<MP.maxPlayers){
    const remaining=this.race.remaining;this.nextRound();this.race.remaining=remaining;
   }else this.fillSeats();
  }return true;
 }
 leave(id){
  const client=this.clients.get(id);if(!client)return;
  const bike=this.race.cycles[client.seat];
  this.queue=this.queue.filter(x=>x!==id);
  if(bike?.alive&&!(this.race.phase==='countdown'&&this.race.cameraStaging)){
   // Lost connection mid-round: the round never waits. The cycle carries straight on
   // with no input until it crashes; the rider is removed when the round ends.
   Object.assign(client,{disconnected:true,cameraReady:true,inputs:[],control:{turbo:false,brake:false}});
   return;
  }
  if(bike&&this.race.phase==='countdown'&&this.race.cameraStaging){delete bike.human;delete bike.operator;}
  this.clients.delete(id);
  if(this.race.phase==='countdown'&&this.race.cameraStaging)this.fillSeats();
 }
 // Humans play together: each one joins the team already holding the most
 // humans that still has a free seat, so 2 humans with 3-cycle teams share a
 // team and a 4th starts a second team. Ties (including the first human) pick
 // a random team, and the slot within a team is random.
 fillSeats(){
  const occupied=new Set([...this.clients.values()].map(c=>c.seat).filter(x=>x!==null));
  const humans=new Map(),teamOrder=this.shuffle([...new Set(this.race.cycles.map(b=>b.team))]);
  for(const seat of occupied){const team=this.race.cycles[seat]?.team;if(team!==undefined)humans.set(team,(humans.get(team)??0)+1);}
  while(this.queue.length){
   const freeByTeam=new Map();
   for(const b of this.race.cycles)if(!occupied.has(b.id))freeByTeam.set(b.team,[...(freeByTeam.get(b.team)??[]),b.id]);
   if(!freeByTeam.size)break;
   const team=teamOrder.filter(t=>freeByTeam.has(t)).reduce((best,t)=>(humans.get(t)??0)>(humans.get(best)??0)?t:best);
   const client=this.clients.get(this.queue.shift());if(!client)continue;
   const seats=freeByTeam.get(team);
   client.seat=seats[Math.floor(this.random()*seats.length)];occupied.add(client.seat);humans.set(team,(humans.get(team)??0)+1);
   client.cameraReady=false;client.inputs=[];client.control={turbo:false,brake:false};client.lastTurnTick=-Infinity;
   Object.assign(this.race.cycles[client.seat],{human:true,operator:client.label});
  }
 }
 connectedCount(){let n=0;for(const c of this.clients.values())if(!c.disconnected)n++;return n;}
 nextRound(){
  // Riders still disconnected at the end of a round leave; on reconnecting they join the queue.
  for(const [id,c] of this.clients)if(c.disconnected)this.clients.delete(id);
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
  resetCycleRound(this.race);this.race.remaining=MP.countdownSeconds;this.race.cameraStaging=true;this.race.materializing=false;this.race.stagingElapsed=0;
  for(const c of this.clients.values())c.cameraReady=false;
  // Survivors keep seats, but get a new randomly assigned team/slot.
  this.queue=[...this.shuffle(survivors.map(c=>c.id)),...this.queue.filter(id=>!survivors.some(c=>c.id===id))];
  this.fillSeats();
 }
 restart(id,round){
  if(round!==this.race.round||!restartAllowed(this.race,[...this.clients.values()],id))return false;
  this.nextRound();
  // The new camera/formation sequence replaces the old instant launch.
  return true;
 }
 cameraReady(id,round,seat){
  const c=this.clients.get(id);
  if(!c||round!==this.race.round||seat!==c.seat||!this.race.cameraStaging)return false;
  c.cameraReady=true;return true;
 }
 input(id,message){
  const c=this.clients.get(id);
  if(!c||message.round!==this.race.round||!Number.isSafeInteger(message.seq)||message.seq<=c.seq||
   !Number.isSafeInteger(message.tick)||message.tick<this.tick-MP.maxLateTicks||message.tick>this.tick+MP.maxFutureTicks||
   ![-1,0,1].includes(message.turn)||typeof message.turbo!=='boolean'||typeof message.brake!=='boolean')return false;
  c.seq=message.seq;
  if(c.seat===null||!this.race.cycles[c.seat]?.alive||this.race.phase!=='racing'){c.ack=message.seq;return false;}
  if(c.inputs.length>=16)return false;
  // Timestamps validate freshness; they do not postpone a received command.
  // Apply on the next authority tick, without backdating collisions.
  const at=this.tick+1;
  c.inputs.push({...message,at});return true;
 }
 step(){
  if(!this.connectedCount())return;
  this.tick++;
  if(this.race.phase==='result'){
   this.race.time+=1/MP.tickHz;this.race.remaining-=1/MP.tickHz;
   if(this.race.remaining<=0)this.nextRound();return;
  }
  if(this.race.cameraStaging){
   this.race.stagingElapsed+=1/MP.tickHz;
   if([...this.clients.values()].every(c=>c.cameraReady)){
    this.race.cameraStaging=false;this.race.materializing=true;this.race.remaining=MP.materializationSeconds;this.urgentSnapshot=true;
   }
   return;
  }
  const controls=new Map();
  for(const c of this.clients.values()){
   let turn=0;
   while(c.inputs.length&&c.inputs[0].at<=this.tick){
    const m=c.inputs.shift();c.ack=m.seq;c.lastInputTick=this.tick;
    if(m.turn||c.control.turbo!==m.turbo||c.control.brake!==m.brake)this.urgentSnapshot=true;
    c.control={turbo:m.turbo,brake:m.brake};
    if(m.turn&&!turn&&this.tick-c.lastTurnTick>=MP.turnIntervalTicks){turn=m.turn;c.lastTurnTick=this.tick;}
   }
   if(this.tick-c.lastInputTick>MP.inputTimeoutTicks)c.control={turbo:false,brake:false};
   if(c.seat!==null)controls.set(c.seat,{...c.control,turn});
  }
  const previousPhase=this.race.phase;
  updateCycleRace(this.race,1/MP.tickHz,0,false,false,{},controls);
  if(previousPhase!=='result'&&this.race.phase==='result'){this.race.remaining=MP.resultSeconds;this.urgentSnapshot=true;}
  for(const c of this.clients.values())if(!c.disconnected&&c.seat!==null&&!this.race.cycles[c.seat].alive&&!this.queue.includes(c.id))this.queue.push(c.id);
  if(this.race.phase==='racing'&&(this.race.elapsed>=MP.maxMatchSeconds||this.race.trails.length>=MP.maxTrails)){
   this.race.phase='result';this.race.winner=null;this.race.remaining=MP.resultSeconds;
  }
 }
 state(){
  const {occupied,outerOccupied,pendingTurns,...race}=this.race;
  return structuredClone({type:'state',protocol:MP.protocol,tick:this.tick,race,
   clients:[...this.clients.values()].map(c=>({id:c.id,label:c.label,seat:c.seat,ack:c.ack,queue:this.queue.indexOf(c.id)+1,...(c.disconnected?{disconnected:true}:{})})),waiting:this.queue.length});
 }
}

// Trail deltas avoid retransmitting the growing history at every snapshot.
export function wireState(state,previous){
 const {trails,...race}=state.race;
 if(!previous||previous.race.round!==race.round)return {...state,full:true};
 const changed=[];for(let i=0;i<trails.length;i++)if(JSON.stringify(trails[i])!==JSON.stringify(previous.race.trails[i]))changed.push([i,trails[i]]);
 return {...state,race,trailLength:trails.length,trailChanges:changed,full:false};
}
