import {ArenaHub} from '../../shared/multiplayer/hub.js';
import {MP,MP_PRESENCE,presenceMessage} from '../../shared/multiplayer/config.js';
// One named object is the shared arena. No timer or storage while it is empty.
// Presence watchers use hibernatable sockets, so an empty arena with watchers sleeps;
// their keep-alive pings are answered without waking it.
export class MultiplayerArena{
 constructor(ctx){
  this.ctx=ctx;
  this.hub=new ArenaHub({onPlayers:players=>{const message=presenceMessage(players);for(const ws of this.watchers())try{ws.send(message);}catch{}}});
  try{ctx?.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping','pong'));}catch{}
 }
 watchers(){return this.ctx?.getWebSockets?.('watch')??[];}
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname===MP_PRESENCE.statusPath)return Response.json(this.hub.status());
  if(url.pathname===MP_PRESENCE.watchPath){
   if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:400});
   if(this.watchers().length>=MP_PRESENCE.maxWatchers)return new Response('Too many watchers',{status:503});
   const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,['watch']);
   server.send(presenceMessage(this.hub.playerCount()));
   return new Response(null,{status:101,webSocket:client});
  }
  const protocol=Number(url.searchParams.get('v'));
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket'||protocol!==MP.protocol)return new Response('WebSocket protocol required',{status:400});
  const [client,server]=Object.values(new WebSocketPair());server.accept();this.hub.add(server,protocol);
  return new Response(null,{status:101,webSocket:client});
 }
 // Watchers only listen; anything other than the auto-answered ping is ignored.
 webSocketMessage(){}
 webSocketClose(ws,code){try{ws.close(code===1005?1000:code,'Closed');}catch{}}
 webSocketError(ws){try{ws.close(1011,'Error');}catch{}}
}
