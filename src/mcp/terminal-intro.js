import musicUrl from '../../docs/assets/music/Tron/20 Break In (For Strings, Flutes And Celesta - Bonus).mp3?url';
export const MCP_ACCESS_TEXT='REQUEST: ACCESS TO MASTER CONTROL\nPROGRAM. USER CODE 00 - DILLINGER.\nPASSWORD: MASTER.'.replace(/ {2,}/g,' ');
const TIMING={startMs:1000,keyMinMs:35,keyVariationMs:95,wordPauseMs:90,linePauseMs:420};
/** Human-paced access request; owned timers are cancelled when the page leaves. */
export function typeMcpAccess(element,onComplete){
 let timer,index=0,cancelled=false;
 const music=new Audio(musicUrl);music.preload='auto';music.volume=.6;
 element.textContent='';
 element.classList.add('typing');
 const next=()=>{
  if(cancelled)return;
  if(index<MCP_ACCESS_TEXT.length){
   if(index===0)void music.play().catch(error=>console.warn('MCP music unavailable:',error.message));
   const character=MCP_ACCESS_TEXT[index++];
   element.textContent=MCP_ACCESS_TEXT.slice(0,index);
   const delay=character==='\n'?TIMING.linePauseMs:TIMING.keyMinMs+Math.random()*TIMING.keyVariationMs+(character===' '?TIMING.wordPauseMs:0);
   timer=setTimeout(next,delay);
  }else{
   element.classList.remove('typing');
   onComplete?.();
  }
 };
 const beep=new Audio(new URL('audio/mcp-access-beep.wav',document.baseURI));
 beep.preload='auto';
 // Begin the one-second lead from actual playback, not from the fetch request.
 void beep.play().catch(error=>console.warn('MCP access beep unavailable:',error.message)).then(()=>{
  if(!cancelled)timer=setTimeout(next,TIMING.startMs);
 });
 const cancel=()=>{music.pause();music.removeAttribute('src');music.load();cancelled=true;clearTimeout(timer);beep.pause();beep.removeAttribute('src');beep.load();element.classList.remove('typing');};
 cancel.pauseMusic=()=>music.pause();
 cancel.resumeMusic=()=>{if(index>0&&!cancelled&&!music.ended)void music.play().catch(()=>{});};
 return cancel;
}
