import {WebSocketServer} from 'ws';
import {ArenaHub} from '../shared/multiplayer/hub.js';
import {MP,MP_PRESENCE,presenceMessage} from '../shared/multiplayer/config.js';
export function multiplayerPlugin(){
 const configure=server=>{
  const watchers=new Set();
  const hub=new ArenaHub({onPlayers:players=>{const message=presenceMessage(players);for(const ws of watchers)try{ws.send(message);}catch{}}});
  const sockets=new WebSocketServer({noServer:true,maxPayload:MP.maxMessageBytes});
  const upgrade=(request,socket,head)=>{
   const url=new URL(request.url,'http://localhost');if(url.pathname!=='/api/multiplayer'&&url.pathname!==MP_PRESENCE.watchPath)return;
   let valid=false;try{valid=new URL(request.headers.origin).host===request.headers.host;}catch{}
   if(url.pathname===MP_PRESENCE.watchPath){
    if(!valid||watchers.size>=MP_PRESENCE.maxWatchers){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    sockets.handleUpgrade(request,socket,head,ws=>{
     watchers.add(ws);ws.send(presenceMessage(hub.playerCount()));
     ws.on('message',data=>{if(String(data)==='ping')ws.send('pong');});
     ws.on('close',()=>watchers.delete(ws));ws.on('error',()=>{watchers.delete(ws);ws.close();});
    });
    return;
   }
   const protocol=Number(url.searchParams.get('v'));
   if(!valid||protocol!==MP.protocol){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
   sockets.handleUpgrade(request,socket,head,ws=>hub.add(ws,protocol));
  };
  server.middlewares?.use(MP_PRESENCE.statusPath,(request,response)=>{
   response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
   response.end(JSON.stringify(hub.status()));
  });
  server.httpServer?.on('upgrade',upgrade);
  server.httpServer?.once('close',()=>{hub.dispose();for(const ws of watchers)ws.close();watchers.clear();sockets.close();server.httpServer.off('upgrade',upgrade);});
 };
 return {name:'cycle-multiplayer',configureServer:configure,configurePreviewServer:configure};
}
