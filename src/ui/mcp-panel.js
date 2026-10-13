// Keep MCP's document/worker alive between visits to avoid rebuilding GPU sessions.
export function createMcpPanel({onClose}){
 let frame,active=false;
 const receive=event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(event.data?.type==='mcp-home'){
   active=false;frame.hidden=true;onClose();
  }
 };
 window.addEventListener('message',receive);
 return {
  get active(){return active;},
  open(){
   active=true;
   if(!frame){
    frame=document.createElement('iframe');frame.id='mcp-panel';frame.title='Master Control Program';frame.allow='microphone; autoplay';
    Object.assign(frame.style,{position:'fixed',inset:'0',width:'100%',height:'100%',border:'0',zIndex:'1100',background:'#020204'});
    frame.src=new URL('./mcp.html',document.baseURI).href;document.body.append(frame);
   }else{frame.hidden=false;frame.contentWindow.postMessage({type:'mcp-resume'},location.origin);}
   frame.focus();
  },
  dispose(){window.removeEventListener('message',receive);frame?.remove();frame=null;active=false;},
 };
}
