import {MP_PRESENCE} from '../../shared/multiplayer/config.js';
// How many humans are in the multiplayer arena, without joining it. A watcher
// socket hears every change at once; if it cannot connect, the status endpoint is
// polled instead. `players` is null while unknown (never connected, or offline).
export function multiplayerBase(){
 const env=import.meta.env??{};
 return env.VITE_MULTIPLAYER_URL||(env.DEV?location.origin:env.VITE_JEV_API_BASE||location.origin);
}
/** Menu label for the multiplayer entry: '' when unknown. */
export function arenaPlayersLabel(players){
 if(players==null)return '';
 return players===0?'(NO PLAYERS)':players===1?'(1 PLAYER)':`(${players} PLAYERS)`;
}
export class ArenaPresence{
 constructor({base=multiplayerBase(),onChange=()=>{},WebSocketImpl=globalThis.WebSocket,fetchImpl=(...a)=>globalThis.fetch(...a)}={}){
  Object.assign(this,{onChange,WebSocketImpl,fetchImpl});
  this.watchUrl=new URL(MP_PRESENCE.watchPath,base);this.watchUrl.protocol=this.watchUrl.protocol==='https:'?'wss:':'ws:';
  this.statusUrl=new URL(MP_PRESENCE.statusPath,base);
  this.players=null;this.active=false;this.failures=0;this.socket=null;this.timer=0;this.ping=0;
 }
 set(players){
  const next=Number.isInteger(players)&&players>=0?players:null;if(next===this.players)return;
  const previous=this.players;this.players=next;this.onChange(next,previous);
 }
 start(){if(this.active)return;this.active=true;this.failures=0;this.connect();}
 stop(){
  this.active=false;clearTimeout(this.timer);clearInterval(this.ping);this.timer=this.ping=0;
  if(this.socket){const s=this.socket;this.socket=null;s.onopen=s.onmessage=s.onclose=s.onerror=null;try{s.close(1000,'Done');}catch{}}
  this.set(null);
 }
 connect(){
  if(!this.active)return;
  let socket;try{socket=new this.WebSocketImpl(this.watchUrl);}catch{this.fallback();return;}
  this.socket=socket;
  socket.onopen=()=>{this.failures=0;clearInterval(this.ping);this.ping=setInterval(()=>{try{socket.send('ping');}catch{}},MP_PRESENCE.pingSeconds*1000);};
  socket.onmessage=event=>{if(event.data==='pong')return;try{const m=JSON.parse(event.data);if(m?.type==='arena')this.set(m.players);}catch{}};
  socket.onerror=()=>{};
  socket.onclose=()=>{if(this.socket!==socket)return;this.socket=null;clearInterval(this.ping);this.ping=0;this.fallback();};
 }
 // Poll once now, then retry the watcher with backoff.
 async fallback(){
  if(!this.active)return;
  const delays=MP_PRESENCE.reconnectSeconds,delay=delays[Math.min(this.failures++,delays.length-1)];
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.connect(),delay*1000);
  await this.poll();
 }
 async poll(){
  try{const r=await this.fetchImpl(this.statusUrl,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const s=await r.json();if(this.active)this.set(s.players);}
  catch{if(this.active)this.set(null);}
 }
}
