import musicUrl from '../../docs/assets/music/Tron/20 Break In (For Strings, Flutes And Celesta - Bonus).mp3?url';
export const MCP_ACCESS_TEXT='REQUEST: ACCESS TO MASTER CONTROL PROGRAM.';
const TIMING={startMs:1000,completedHoldMs:1500,keyMinMs:35,keyVariationMs:95,wordPauseMs:90,linePauseMs:420};
/** Human-paced access request; owned timers are cancelled when the page leaves. */
export function typeMcpAccess(element,onComplete,{audioContext}={}){
 let timer,index=0,cancelled=false;
 const music=new Audio(musicUrl);music.preload='auto';music.volume=.6;
 // Share the already-running output engine with speech: no new live audio
 // context or media rerouting at the moment the MCP begins talking.
 const musicSource=audioContext?.createMediaElementSource(music);musicSource?.connect(audioContext.destination);
 const playMusic=async()=>{await audioContext?.resume();if(!cancelled)await music.play();};
 element.textContent='';
 element.classList.add('typing');
 const next=()=>{
  if(cancelled)return;
  if(index<MCP_ACCESS_TEXT.length){
   const character=MCP_ACCESS_TEXT[index++];
   element.textContent=MCP_ACCESS_TEXT.slice(0,index);
   const delay=character==='\n'?TIMING.linePauseMs:TIMING.keyMinMs+Math.random()*TIMING.keyVariationMs+(character===' '?TIMING.wordPauseMs:0);
   timer=setTimeout(next,delay);
  }else{
   element.classList.remove('typing');
   timer=setTimeout(()=>{if(!cancelled)onComplete?.();},TIMING.completedHoldMs);
  }
 };
 const beep=new Audio(new URL('audio/mcp-access-beep.wav',document.baseURI));
 beep.preload='auto';
 // Begin the one-second lead from actual playback, not from the fetch request.
 void beep.play().catch(error=>console.warn('MCP access beep unavailable:',error.message)).then(()=>{
  if(!cancelled){
   void playMusic().catch(error=>console.warn('MCP music unavailable:',error.message)).then(()=>{
    if(!cancelled)timer=setTimeout(next,TIMING.startMs);
   });
  }
 });
 const cancel=()=>{music.pause();musicSource?.disconnect();music.removeAttribute('src');music.load();cancelled=true;clearTimeout(timer);beep.pause();beep.removeAttribute('src');beep.load();element.classList.remove('typing');};
 cancel.pauseMusic=()=>music.pause();
 cancel.resumeMusic=()=>{if(!cancelled&&!music.ended)void playMusic().catch(()=>{});};
 return cancel;
}
