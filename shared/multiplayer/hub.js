import {projectState,compactSnapshot} from './snapshots.js';
import {CycleRoom,wireState} from './room.js';
import {MP} from './config.js';

export class ArenaHub{
 constructor(){this.peers=new Map();this.room=null;this.timer=null;this.previous=null;this.timing={pumps:0,maxPumpGapMs:0,latePumps:0,discardedMs:0,maxCatchupSteps:0,snapshots:0};}
 add(socket,protocol=MP.protocol){
  this.room??=new CycleRoom({seed:crypto.getRandomValues(new Uint32Array(1))[0]});
  const id=crypto.randomUUID();
  if(!this.room.join(id)){socket.close(1013,'Arena spectator limit reached');return;}
  const peer={id,socket,protocol,baseline:null,seen:Date.now(),window:Date.now(),messages:0};this.peers.set(id,peer);
  this.send(peer,{type:'welcome',protocol,id});
  const initial=this.room.state();
  if(protocol===MP.protocol){peer.baseline=projectState(initial);this.send(peer,compactSnapshot(peer.baseline,null));}
  else this.send(peer,{...initial,protocol,full:true});
  socket.addEventListener('message',event=>{
   const now=Date.now();if(now-peer.window>1000){peer.window=now;peer.messages=0;}
   if(typeof event.data!=='string'||event.data.length>MP.maxMessageBytes||++peer.messages>MP.maxMessagesPerSecond){socket.close(1008,'Invalid or excessive input');return;}
   let message;try{message=JSON.parse(event.data);}catch{socket.close(1008,'Invalid input');return;}
   peer.seen=now;
   if(message?.type==='ping'&&Number.isFinite(message.sent))this.send(peer,{type:'pong',sent:message.sent,tick:this.room.tick,timing:{...this.timing}});
   else if(message?.type==='input')this.room.input(id,message);
   else if(message?.type==='camera-ready')this.room.cameraReady(id,message.round,message.seat);
   else if(message?.type==='restart')this.room.restart(id,message.round);
   else if(message?.type==='resync'&&peer.protocol===MP.protocol){peer.baseline=projectState(this.room.state());this.send(peer,compactSnapshot(peer.baseline,null));}
  });
  const remove=()=>{this.peers.delete(id);this.room?.leave(id);if(!this.peers.size){clearInterval(this.timer);this.timer=null;this.room=null;this.previous=null;}};
  socket.addEventListener('close',remove);socket.addEventListener('error',()=>{socket.close();remove();});
  if(!this.timer){this.last=performance.now();this.accumulator=0;this.timer=setInterval(()=>this.pump(),1000/60);}
 }
 send(peer,data){
  try{if((peer.socket.bufferedAmount??0)>MP.maxBufferedBytes){peer.socket.close(1013,'Connection too slow');return;}peer.socket.send(typeof data==='string'?data:JSON.stringify(data));}catch{peer.socket.close();}
 }
 pump(){
  if(!this.room)return;
  const now=performance.now(),gap=Math.max(0,now-this.last);this.last=now;
  this.timing.pumps++;this.timing.maxPumpGapMs=Math.max(this.timing.maxPumpGapMs,gap);
  if(gap>50)this.timing.latePumps++;
  this.timing.discardedMs+=Math.max(0,gap-200);
  this.accumulator+=Math.min(.2,gap/1000);
  let broadcast=false;
  let steps=0;
  while(this.accumulator>=1/MP.tickHz&&steps++<MP.maxCatchupSteps){
   this.accumulator-=1/MP.tickHz;this.room.step();
   if(this.room.tick%MP.snapshotTicks===0||this.room.urgentSnapshot){
    this.room.urgentSnapshot=false;
    broadcast=true;
   }
  }
  this.timing.maxCatchupSteps=Math.max(this.timing.maxCatchupSteps,Math.min(steps,MP.maxCatchupSteps));
  // Catch-up retains every simulation step and turn, but sends only the newest
  // snapshot. Queuing intermediate snapshots adds work and stale network data.
  if(broadcast){
    const state=this.room.state(),compact=projectState(state),messages=new Map(),sentAt=Date.now();
    this.timing.snapshots++;
    // Encode once per baseline/version, not once per player. A newly joined peer
    // may have a newer baseline than the room's last broadcast.
    for(const peer of this.peers.values()){
     const key=peer.protocol===MP.protocol?peer.baseline:'legacy';
     if(!messages.has(key)){
      const packet=peer.protocol===MP.protocol?compactSnapshot(compact,peer.baseline):{...wireState(state,this.previous),protocol:peer.protocol};
      messages.set(key,JSON.stringify({...packet,sentAt}));
     }
     this.send(peer,messages.get(key));if(peer.protocol===MP.protocol)peer.baseline=compact;
    }
    this.previous=state;
  }
  if(this.room.race.cameraStaging&&this.room.race.stagingElapsed>MP.cameraReadyTimeoutSeconds){
   for(const peer of this.peers.values())if(!this.room.clients.get(peer.id)?.cameraReady)peer.socket.close(1001,'Camera preparation timed out');
  }
  for(const peer of this.peers.values())if(Date.now()-peer.seen>MP.connectionTimeoutSeconds*1000)peer.socket.close(1001,'Connection timed out');
 }
 dispose(){clearInterval(this.timer);this.timer=null;for(const peer of [...this.peers.values()])peer.socket.close(1001,'Arena restarting');this.peers.clear();this.room=null;}
}
