import {CycleRoom,wireState} from './room.js';
import {MP} from './config.js';

export class ArenaHub{
 constructor(){this.peers=new Map();this.room=null;this.timer=null;this.previous=null;}
 add(socket){
  this.room??=new CycleRoom({seed:crypto.getRandomValues(new Uint32Array(1))[0]});
  const id=crypto.randomUUID();
  if(!this.room.join(id)){socket.close(1013,'Arena spectator limit reached');return;}
  const peer={id,socket,seen:Date.now(),window:Date.now(),messages:0};this.peers.set(id,peer);
  this.send(peer,{type:'welcome',protocol:MP.protocol,id});this.send(peer,{...this.room.state(),full:true});
  socket.addEventListener('message',event=>{
   const now=Date.now();if(now-peer.window>1000){peer.window=now;peer.messages=0;}
   if(typeof event.data!=='string'||event.data.length>MP.maxMessageBytes||++peer.messages>MP.maxMessagesPerSecond){socket.close(1008,'Invalid or excessive input');return;}
   let message;try{message=JSON.parse(event.data);}catch{socket.close(1008,'Invalid input');return;}
   peer.seen=now;
   if(message?.type==='ping'&&Number.isFinite(message.sent))this.send(peer,{type:'pong',sent:message.sent,tick:this.room.tick});
   else if(message?.type==='input')this.room.input(id,message);
  });
  const remove=()=>{this.peers.delete(id);this.room?.leave(id);if(!this.peers.size){clearInterval(this.timer);this.timer=null;this.room=null;this.previous=null;}};
  socket.addEventListener('close',remove);socket.addEventListener('error',()=>{socket.close();remove();});
  if(!this.timer){this.last=performance.now();this.accumulator=0;this.timer=setInterval(()=>this.pump(),1000/60);}
 }
 send(peer,data){
  try{if((peer.socket.bufferedAmount??0)>MP.maxBufferedBytes){peer.socket.close(1013,'Connection too slow');return;}peer.socket.send(JSON.stringify(data));}catch{peer.socket.close();}
 }
 pump(){
  if(!this.room)return;
  const now=performance.now();this.accumulator+=Math.min(.2,(now-this.last)/1000);this.last=now;
  let steps=0;
  while(this.accumulator>=1/MP.tickHz&&steps++<MP.maxCatchupSteps){
   this.accumulator-=1/MP.tickHz;this.room.step();
   if(this.room.tick%MP.snapshotTicks===0){
    const state=this.room.state(),wire=wireState(state,this.previous);this.previous=state;
    for(const peer of this.peers.values())this.send(peer,wire);
   }
  }
  for(const peer of this.peers.values())if(Date.now()-peer.seen>MP.connectionTimeoutSeconds*1000)peer.socket.close(1001,'Connection timed out');
 }
 dispose(){clearInterval(this.timer);this.timer=null;for(const peer of [...this.peers.values()])peer.socket.close(1001,'Arena restarting');this.peers.clear();this.room=null;}
}
