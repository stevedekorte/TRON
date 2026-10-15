import {RemotePlayback,presentRemoteCycles} from './remote-playback.js';
import {decodeSnapshot} from '../../shared/multiplayer/snapshots.js';
import {MP} from '../../shared/multiplayer/config.js';
import {LIGHT_CYCLES as C,CYCLE_DIRECTIONS as DIR} from '../../shared/simulation/config/light-cycles.js';
import {cyclePlayerPose} from '../../shared/simulation/light-cycles.js';

export const PREDICTION_CLOCK=Object.freeze({maxRateAdjustment:.1,correctionSeconds:.25,maxFrameSeconds:.2});

// Predict motion only. Collisions, eliminations, seats and trail history remain server-owned.
function move(b,seconds,control){
 const [dx,dz]=DIR[b.dir];b.x+=dx*seconds*C.speedMetersPerSecond/C.cellMeters*b.speedMultiplier;b.z+=dz*seconds*C.speedMetersPerSecond/C.cellMeters*b.speedMultiplier;
 b.braking=control.brake&&b.brakeCharge>0;b.boosting=control.turbo&&!control.brake&&b.turboCharge>0;
 const target=b.braking?C.slowSpeedMultiplier:b.boosting?C.turboSpeedMultiplier:1;
 b.speedMultiplier+=(target-b.speedMultiplier)*(1-Math.exp(-(target>b.speedMultiplier&&b.boosting?C.turboResponsePerSecond:C.speedResponsePerSecond)*seconds));
 b.turboCharge=Math.max(0,Math.min(1,b.turboCharge+seconds*(b.boosting?-1/C.turboDurationSeconds:!control.turbo||control.brake?1/C.turboRechargeSeconds:0)));
 b.brakeCharge=Math.max(0,Math.min(1,b.brakeCharge+seconds*(b.braking?-1/C.brakeDurationSeconds:!control.brake?1/C.brakeRechargeSeconds:0)));
}
export class MultiplayerClient{
 constructor({url,onStatus=()=>{}}={}){
  const base=url||import.meta.env.VITE_MULTIPLAYER_URL||(import.meta.env.DEV?location.origin:import.meta.env.VITE_JEV_API_BASE||location.origin);
  this.url=new URL('/api/multiplayer',base);this.url.protocol=this.url.protocol==='https:'?'wss:':this.url.protocol==='http:'?'ws:':this.url.protocol;this.url.searchParams.set('v',MP.protocol);
  this.remotePlayback=new RemotePlayback();this.onStatus=onStatus;this.seq=0;this.pending=[];this.rtt=0;this.closed=false;this.lastSent=0;this.control={turbo:false,brake:false};
 }
 connect(){
  return new Promise((resolve,reject)=>{
   this.socket=new WebSocket(this.url);
   const timeout=setTimeout(()=>{reject(Error('MULTIPLAYER CONNECTION TIMED OUT'));this.close();},12000);
   this.socket.onopen=()=>{this.ping();this.heartbeat=setInterval(()=>this.ping(),MP.heartbeatSeconds*1000);};
   this.socket.onmessage=event=>{
    let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.type==='welcome'){if(data.protocol!==MP.protocol){this.close();reject(Error('MULTIPLAYER VERSION MISMATCH'));}this.id=data.id;return;}
    if(data.type==='pong'){this.rtt=Math.max(0,performance.now()-data.sent);return;}
    if(data.type!=='state'||data.protocol!==MP.protocol||!this.id)return;
    data=decodeSnapshot(data,this.state);
    if(!data){if(!this.resyncPending){this.resyncPending=true;this.socket.send(JSON.stringify({type:'resync'}));}return;}
    this.resyncPending=false;
    const me=data.clients.find(c=>c.id===this.id);if(!me)return;
    if(this.state?.race.round!==data.race.round){this.pending=[];this.control={turbo:false,brake:false};this.lastSent=0;}
    this.pending=this.pending.filter(p=>p.seq>me.ack);this.state=data;this.me=me;this.received=performance.now();this.remotePlayback.push(data,this.received);
    this.onStatus('connected');clearTimeout(timeout);resolve(this);
   };
   this.socket.onerror=()=>{clearTimeout(timeout);reject(Error('MULTIPLAYER CONNECTION UNAVAILABLE'));};
   this.socket.onclose=()=>{clearTimeout(timeout);clearInterval(this.heartbeat);if(!this.closed){this.disconnected=true;this.onStatus('disconnected');reject(Error('MULTIPLAYER DISCONNECTED'));}};
  });
 }
 ping(){if(this.socket?.readyState===1)this.socket.send(JSON.stringify({type:'ping',sent:performance.now()}));}
 restart(){
  if(!this.state||this.closed||this.disconnected||this.socket?.readyState!==1||this.state.clients.length!==1||performance.now()-this.received>2000)return false;
  this.socket.send(JSON.stringify({type:'restart',round:this.state.race.round}));return true;
 }
 estimatedRenderTick(){
  const now=performance.now(),round=this.state.race.round;
  const target=this.state.tick+((now-this.received)+this.rtt/2)*MP.tickHz/1000;
  let clock=this.predictionClock;
  if(!clock||clock.round!==round)clock=this.predictionClock={round,tick:target,now};
  else{
   const dt=Math.max(0,Math.min(PREDICTION_CLOCK.maxFrameSeconds,(now-clock.now)/1000));
   const expected=clock.tick+dt*MP.tickHz;
   const correction=(target-expected)/(MP.tickHz*PREDICTION_CLOCK.correctionSeconds);
   const rate=1+Math.max(-PREDICTION_CLOCK.maxRateAdjustment,Math.min(PREDICTION_CLOCK.maxRateAdjustment,correction));
   clock.tick+=dt*MP.tickHz*rate;clock.now=now;
  }
  // Packet jitter and RTT changes adjust the rate, never reset the camera's time.
  return clock.tick;
 }
 estimatedTick(){return Math.floor(this.estimatedRenderTick());}
 input(command){
  if(!this.state||this.closed||this.disconnected||this.socket.readyState!==1)return;
  const control={turbo:!!command.cycleTurbo,brake:!!command.cycleSlow},turn=Math.sign(command.cycleTurn||0);
  const now=performance.now();if(!turn&&control.turbo===this.control.turbo&&control.brake===this.control.brake&&now-this.lastSent<250)return;
  this.control=control;this.lastSent=now;
  const predictionTick=this.estimatedRenderTick();
  const packet={type:'input',round:this.state.race.round,seq:++this.seq,tick:Math.floor(predictionTick),turn,...control};
  this.socket.send(JSON.stringify(packet));
  if(this.me.seat!==null&&this.state.race.phase==='racing'&&this.state.race.cycles[this.me.seat]?.alive)this.pending.push({...packet,predictionTick});
  if(this.pending.length>32)this.pending.shift();
 }
 apply(run){
  if(!this.state)return false;
  this.remotePlayback??=new RemotePlayback();
  this.remotePlayback.push(this.state,this.received);
  const previous=run.cycleRace,site=previous.site,race={closedArena:false,derezOnEscape:true,arenaPaused:false,breaches:[],accumulator:0,...this.state.race,site,
   cycles:this.state.race.cycles.map(b=>({...b,previousX:b.x,previousZ:b.z,progress:1,continuousArena:true})),trails:this.state.race.trails.slice(),
   occupied:previous.occupied,outerOccupied:{},pendingTurns:[],playerId:this.me.seat??0,localPlayerId:this.me.seat};
  const waiting=this.me.seat===null||!race.cycles[this.me.seat]?.alive;
  const stale=performance.now()-this.received>2000;
  if(race.phase==='racing'&&!stale&&!this.disconnected){
   const ticks=Math.max(0,Math.min(MP.maxFutureTicks,this.estimatedRenderTick()-this.state.tick));
   const targetTick=this.state.tick+ticks;
   for(const b of race.cycles){
    if(!b.alive||b.id!==this.me.seat)continue;
    let control={turbo:!!b.reserveTurboRequested,brake:!!b.reserveBrakeRequested};
    let cursor=this.state.tick;
    const advance=to=>{
     while(cursor<to){
      const end=Math.min(to,Math.floor(cursor)+1);
      move(b,(end-cursor)/MP.tickHz,control);cursor=end;
     }
    };
    for(const p of this.pending){
     // Preserve the fractional keypress time locally; wire ticks stay integer.
     // Replay each unacknowledged event exactly once on top of this snapshot.
     const at=Math.max(cursor,p.predictionTick??p.tick);
     if(at>targetTick)break;
     advance(at);control=p;
     if(p.turn){
      const tail=race.trails[b.segment];
      if(tail)race.trails[b.segment]={...tail,x2:b.x,z2:b.z};
      b.dir=(b.dir+p.turn+4)%4;b.turns++;
      race.trails.push({bikeId:b.id,team:b.team,dir:b.dir,x1:b.x,z1:b.z,x2:b.x,z2:b.z});b.segment=race.trails.length-1;
     }
     move(b,0,control);
    }
    advance(targetTick);
    const tail=race.trails[b.segment];if(tail)race.trails[b.segment]={...tail,x2:b.x,z2:b.z};
    b.previousX=b.x;b.previousZ=b.z;b.progress=1;b.continuousArena=true;
   }
  }
  if(race.phase==='racing'&&!stale&&!this.disconnected)presentRemoteCycles(race,this.remotePlayback.sample(performance.now()),this.me.seat);
  // Audio/effects own per-race and per-cycle lifetimes. Network snapshots
  // replace values, not those identities, until a new match actually starts.
  if(previous.round===race.round){
   race.cycles=race.cycles.map(b=>{
    const old=previous.cycles[b.id];
    // A serialized copy of the same reward is not a new HUD animation.
    if(b.reserveReward&&old?.reserveReward&&['revision','turboFrom','brakeFrom','target'].every(key=>b.reserveReward[key]===old.reserveReward[key]))b.reserveReward=old.reserveReward;
    if(old)for(const key of ['human','operator','reserveReward','wallEliminations','trapAssists'])if(!(key in b))delete old[key];
    return Object.assign(old??{},b);
   });
   Object.assign(previous,race);run.cycleRace=previous;
  }else run.cycleRace=race;
  run.time=race.time;run.playerVehicle='cycle';run.arenaWaiting=false;run.cycleEntryRequested=false;
  run.won=false;run.crushed=false;run.speed=0;run.gunner=false;run.turretYaw=0;run.aimPitch=0;
  if(previous.round!==race.round){run.cycleFollowId=null;run.inspection=false;}
  run.cycleSpectating=waiting;
  run.multiplayer={connected:!this.disconnected&&!stale,seat:this.me.seat,queue:this.me.queue,waiting:this.state.waiting,unseatedWaiting:this.state.clients.filter(c=>c.seat===null&&c.queue>0).length,players:this.state.clients.length,ping:Math.round(this.rtt),round:race.round};
  Object.assign(run,cyclePlayerPose(race));return true;
 }
 close(){this.closed=true;clearInterval(this.heartbeat);this.socket?.close(1000,'Leaving arena');this.pending=[];this.remotePlayback?.reset();}
}
