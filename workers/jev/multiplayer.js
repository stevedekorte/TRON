import {ArenaHub} from '../../shared/multiplayer/hub.js';
import {MP} from '../../shared/multiplayer/config.js';
// One named object is the shared arena. No timer or storage while it is empty.
export class MultiplayerArena{
 constructor(){this.hub=new ArenaHub();}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket'||new URL(request.url).searchParams.get('v')!==String(MP.protocol))return new Response('WebSocket protocol required',{status:400});
  const [client,server]=Object.values(new WebSocketPair());server.accept();this.hub.add(server);
  return new Response(null,{status:101,webSocket:client});
 }
}
