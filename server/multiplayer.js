import {WebSocketServer} from 'ws';
import {ArenaHub} from '../shared/multiplayer/hub.js';
import {MP} from '../shared/multiplayer/config.js';
export function multiplayerPlugin(){
 const configure=server=>{
  const hub=new ArenaHub(),sockets=new WebSocketServer({noServer:true,maxPayload:MP.maxMessageBytes});
  const upgrade=(request,socket,head)=>{
   const url=new URL(request.url,'http://localhost');if(url.pathname!=='/api/multiplayer')return;
   let valid=false;try{valid=new URL(request.headers.origin).host===request.headers.host;}catch{}
   if(!valid||url.searchParams.get('v')!==String(MP.protocol)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
   sockets.handleUpgrade(request,socket,head,ws=>hub.add(ws));
  };
  server.httpServer?.on('upgrade',upgrade);
  server.httpServer?.once('close',()=>{hub.dispose();sockets.close();server.httpServer.off('upgrade',upgrade);});
 };
 return {name:'cycle-multiplayer',configureServer:configure,configurePreviewServer:configure};
}
