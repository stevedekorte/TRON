import {publicAssetUrl} from '../assets/public-url.js';
window.mcpBooted=true;clearTimeout(window.mcpBootTimer);
import {createPanelActivity} from './panel-activity.js';
import {typeMcpAccess} from './terminal-intro.js';
import {clearLegacyMcpCache} from './clear-legacy-cache.js';
void clearLegacyMcpCache();
import {McpVoice} from './voice.js';
import {speakSentences} from './speech-queue.js';
import {createVoiceEffects,MCP_VOICE_EFFECTS} from './voice-effects.js';
const $=id=>document.getElementById(id);
const MCP_CLOSING_FADE=Object.freeze({minimumSeconds:.05,finishLeadSeconds:.05});
const apiBase=(import.meta.env.VITE_MCP_API_BASE||import.meta.env.VITE_JEV_API_BASE||'').replace(/\/$/,'');
let face,recognition,recognizing=false,micEnabled=false,busy=false,leaving=false,paused=false,request,epoch=0,restartTimer;
const history=[];
const panelActivity=createPanelActivity($('encom-panel'));
const audioContext=new AudioContext({latencyHint:'playback'});
let introPlaying=true,microphoneApproved=false,microphonePending=false,voiceReadyPromise;
const cancelIntro=typeMcpAccess($('reply'),()=>{introPlaying=false;void requestConversationAudio();},{audioContext});
function unavailable(message='AUDIO INPUT REQUIRED — ALLOW MICROPHONE ACCESS IN YOUR BROWSER. CLICK OR PRESS RETURN TO RETRY.'){
 microphoneApproved=false;setBusy(false);setMic(false);$('heard').textContent='';
 $('reply').textContent='MASTER CONTROL PROGRAM UNAVAILABLE\n'+message;
}
async function requestConversationAudio(){
 if(introPlaying||paused||leaving||microphoneApproved||microphonePending)return;
 microphonePending=true;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Speech input unavailable');
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  stream.getTracks().forEach(track=>track.stop());
  if(leaving)return;
  if(!recognition){unavailable('AUDIO INPUT REQUIRES A BROWSER WITH SPEECH RECOGNITION SUPPORT.');return;}
  microphoneApproved=true;$('reply').textContent='';$('heard').textContent='';
  if(!voice.ready&&!voiceLoading)voiceReadyPromise=loadVoice();
  setBusy(true);
  await voiceReadyPromise;
  if(leaving||paused)return;
  if(!voice.ready)throw Error('Cloned voice unavailable');
  const greeting='IDENTIFY USER AND ACCESS CODE.';
  const token=++epoch;
  const spoken=await speakCloned(greeting,token,{whole:true});
  if(spoken&&token===epoch&&!paused&&!leaving)setMic(true);
 }catch{if(!leaving)unavailable(microphoneApproved?'CLONED VOICE CONNECTION UNAVAILABLE. CLICK OR PRESS RETURN TO RETRY.':undefined);}
 finally{microphonePending=false;}
}
function retryAudio(event){if(!introPlaying&&!microphoneApproved&&!microphonePending&&!paused&&!leaving&&(event.type==='pointerdown'||event.code==='Enter'))void requestConversationAudio();}
window.addEventListener('pointerdown',retryAudio);window.addEventListener('keydown',retryAudio);
function unlockAudio(){void audioContext.resume().catch(()=>{});}
window.addEventListener('pointerdown',unlockAudio);window.addEventListener('keydown',unlockAudio);
let audioSource,audioFrame,voiceLoading=false,finishAudio,chatConfigured=false,audioEffects;
let voiceLoadId=0,voiceStarted=0,voiceProgress={stage:'checking'},voiceClock;
function renderVoiceProgress(){
 $('download-row').hidden=true;
 $('voice-status').textContent=voiceProgress.stage==='ready'?'TTS — READY':voiceProgress.stage==='error'?'TTS — UNAVAILABLE':'TTS — CONNECTING';
}
const voice=new McpVoice(progress=>{if(voiceLoading){voiceProgress={...voiceProgress,...progress};renderVoiceProgress();}});

function stopClonedAudio(){cancelAnimationFrame(audioFrame);audioEffects?.dispose();audioEffects=null;if(audioSource){audioSource.onended=null;audioSource.stop();audioSource.disconnect();}audioSource=null;finishAudio?.();finishAudio=null;}
async function playSamples({samples,sampleRate,processed:rendered=false},token,{processed=rendered,onStart=()=>{}}={}){
 if(token!==epoch)return;
 await audioContext.resume();if(token!==epoch)return;
 const buffer=audioContext.createBuffer(1,samples.length,sampleRate);buffer.copyToChannel(samples,0);
 const source=audioContext.createBufferSource();source.buffer=buffer;
 const rate=processed?1:MCP_VOICE_EFFECTS.pitchRatio;source.playbackRate.value=rate;
 audioEffects?.dispose();audioEffects=processed?null:createVoiceEffects(audioContext);
 source.connect(audioEffects?.input||audioContext.destination);audioSource=source;
 panelActivity.set('');
 const started=audioContext.currentTime;status('MCP SPEAKING');face?.speak(true);
 const animate=()=>{if(token!==epoch)return;const offset=Math.floor((audioContext.currentTime-started)*sampleRate*rate);let sum=0,count=0;
  for(let i=offset;i<Math.min(samples.length,offset+1024);i++){sum+=samples[i]*samples[i];count++;}
  face?.level(Math.min(1,Math.sqrt(sum/Math.max(1,count))*7));audioFrame=requestAnimationFrame(animate);
 };
 await new Promise(resolve=>{let tail;finishAudio=()=>{clearTimeout(tail);resolve();};source.onended=()=>{source.disconnect();face?.speak(false);tail=setTimeout(resolve,processed?0:MCP_VOICE_EFFECTS.decaySeconds*1000);};onStart({speechSeconds:Math.max(MCP_CLOSING_FADE.minimumSeconds,buffer.duration/rate-(processed?MCP_VOICE_EFFECTS.decaySeconds:0))});source.start();animate();});
 cancelAnimationFrame(audioFrame);finishAudio=null;audioSource=null;face?.speak(false);
}
async function speakCloned(text,token,{whole=false,onStart:started=()=>{},onChunkStart=()=>{},resumeListening=true}={}){
 panelActivity.set('tts');
 let displayed=false;const onStart=(timing,chunk=text)=>{if(!displayed){$('reply').textContent=text;displayed=true;started();}onChunkStart(chunk,timing);};
 try{
  if(whole)await playSamples(await voice.generate(text),token,{onStart});
  else await speakSentences({text,generate:chunk=>voice.generate(chunk),play:(audio,chunk)=>playSamples(audio,token,{onStart:timing=>onStart(timing,chunk)}),isCurrent:()=>token===epoch,onWaiting:()=>{panelActivity.set('tts');status('MCP GENERATING VOICE…');}});
  if(token===epoch){if(resumeListening){setBusy(false);status('YOUR TURN');restartTimer=setTimeout(listen,350);}return true;}
 }catch(error){if(token===epoch){face?.speak(false);setBusy(false);status('MCP CLONED VOICE FAILED — REPLY SHOWN AS TEXT: '+error.message);$('reply').textContent=text+'\nMCP CLONED VOICE UNAVAILABLE';}}
 finally{if(token!==epoch){setBusy(false);if(!paused&&!leaving)status('YOUR TURN');}}
}
async function loadVoice(){
 if(voiceLoading||busy)return;voiceLoading=true;const loadId=++voiceLoadId;
 voiceStarted=performance.now();voiceProgress={stage:'checking'};renderVoiceProgress();setBusy(busy);
 clearInterval(voiceClock);voiceClock=setInterval(renderVoiceProgress,1000);
 try{await voice.load();if(loadId!==voiceLoadId)return;
  voiceProgress={stage:'ready'};$('load-voice').textContent='MCP VOICE READY';
 }catch(error){if(loadId===voiceLoadId){voiceProgress={stage:'error',message:error.message+' · CLONED VOICE UNAVAILABLE'};$('load-voice').textContent='RETRY MCP VOICE CONNECTION';}}
 finally{if(loadId===voiceLoadId){clearInterval(voiceClock);voiceLoading=false;renderVoiceProgress();setBusy(busy);if(voice.ready){status('VOICE READY — SPEAK OR TYPE TO MCP');listen();}else status('MCP CLONED VOICE UNAVAILABLE — RETRY VOICE CONNECTION');}}
}
$('load-voice').onclick=loadVoice;
$('voice-sample').onclick=async()=>{
 if(busy)return;stopListening();setBusy(true);const token=++epoch;
 try{await audioContext.resume();
  const response=await fetch(publicAssetUrl('assets/audio/mcp-clone-preview-deeper.wav'));if(!response.ok)throw new Error('VOICE SAMPLE UNAVAILABLE');
  const buffer=await audioContext.decodeAudioData(await response.arrayBuffer());
  if(token!==epoch)return;$('reply').textContent='Welcome, program. Your connection to the Grid is now under my control.';
  await playSamples({samples:buffer.getChannelData(0),sampleRate:buffer.sampleRate},token,{processed:true});
  if(token===epoch){setBusy(false);status('MCP VOICE SAMPLE');}
 }catch(error){if(token===epoch){setBusy(false);status(error.message);}}
};
$('test-voice').onclick=()=>{
 if(!voice.ready||busy)return;stopListening();setBusy(true);const text='Welcome, program. Your connection to the Grid is now under my control.';
 $('reply').textContent=text;void speakCloned(text,++epoch);
};
function status(text){$('status').textContent=text;}
function setBusy(value){busy=value;if(!value)panelActivity.set('');$('message').disabled=value||!chatConfigured||!voice.ready;$('microphone').disabled=value||!voice.ready||!recognition;$('message').placeholder=voice.ready?'SPEAK OR TYPE YOUR MESSAGE':'WAITING FOR MCP VOICE';$('voice-sample').disabled=value;$('test-voice').disabled=value||!voice.ready;$('load-voice').disabled=value||voice.ready||voiceLoading;}
function stopListening(){panelActivity.set('');clearTimeout(restartTimer);if(recognizing){recognizing=false;try{recognition.abort();}catch{}}}
function listen(){
 if(!microphoneApproved||introPlaying||!chatConfigured||!voice.ready||leaving||paused||busy||document.hidden||!micEnabled||!recognition||recognizing)return;
 try{recognition.start();recognizing=true;panelActivity.set('stt');status('LISTENING…');}catch{status('MICROPHONE BUSY — CLICK MIC TO RETRY');}
}
function setMic(value){micEnabled=value;$('microphone').setAttribute('aria-pressed',String(value));$('microphone').textContent=value?'MIC OFF':'MIC ON';if(value)listen();else {stopListening();if(!busy)status('TYPE A MESSAGE TO MCP');}}
function interrupt(){
 epoch++;stopClonedAudio();request?.abort();request=null;face?.speak(false);stopListening();
 voice.abort();
 setBusy(voice.generating);
}

function speak(text,token){
 if(voice.ready){void speakCloned(text,token);return;}
 setBusy(false);face?.speak(false);
 status(voiceLoading?'MCP CLONED VOICE STILL INITIALIZING — REPLY SHOWN AS TEXT':'MCP CLONED VOICE UNAVAILABLE — LOAD VOICE TO ENABLE SPEECH');
}
async function send(text){
 text=text.trim();if(introPlaying||!text||!chatConfigured||!voice.ready||busy||paused||leaving)return;
 stopListening();setBusy(true);$('heard').textContent=text;$('reply').textContent='';$('message').value='';status('MCP PROCESSING…');panelActivity.set('llm');
 const token=++epoch;request=new AbortController();const timeout=setTimeout(()=>request?.abort(),50000);
 const sentAt=performance.now(),waiting=setInterval(()=>{if(token===epoch)status(`WAITING FOR GEMINI — ${Math.floor((performance.now()-sentAt)/1000)}s`);},1000);
 try{
  const response=await fetch(apiBase+'/api/mcp/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[...history,{role:'user',content:text}]}),signal:request.signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'MCP CONNECTION UNAVAILABLE');
  if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('MCP RETURNED AN EMPTY REPLY');
  if(token!==epoch||leaving)return;
  history.push({role:'user',content:text},{role:'assistant',content:data.reply});if(history.length>16)history.splice(0,history.length-16);
  clearInterval(waiting);
  if(data.action?.type==='launch_game'&&data.action.game==='cycles')await announceGame(data.reply,token);
  else speak(data.reply,token);
 }catch(error){if(token===epoch&&!leaving){setBusy(false);const message=error.name==='AbortError'?'GEMINI TIMED OUT — TRY AGAIN':error.message;status(message);$('reply').textContent='MASTER CONTROL PROGRAM UNAVAILABLE';$('message').value=text;}}
 finally{clearInterval(waiting);clearTimeout(timeout);if(token===epoch)request=null;}
}
async function announceGame(text,token){
 document.body.classList.remove('mcp-command-ending');
 // Load the face while TTS is preparing, but reveal it only at audio start.
 const faceReady=(async()=>{if(!face){try{const {createMcpFace}=await import('./face.js');face=await createMcpFace($('face'),{cover:true});}catch{}}})();
 await faceReady;if(token!==epoch||paused||leaving)return;
 face?.pause(false);
 const spoken=await speakCloned(text,token,{resumeListening:false,onStart:()=>document.body.classList.add('mcp-command'),onChunkStart:(chunk,{speechSeconds})=>{
  if(/\bEND\s+OF\s+LINE\b/i.test(chunk)){
   document.body.style.setProperty('--mcp-end-duration',Math.max(MCP_CLOSING_FADE.minimumSeconds,speechSeconds-MCP_CLOSING_FADE.finishLeadSeconds)+'s');
   document.body.classList.add('mcp-command-ending');
  }
 }});
 if(!spoken||token!==epoch||paused||leaving)return;
 await new Promise(resolve=>setTimeout(resolve,1000));
 if(token!==epoch||paused||leaving)return;
 paused=true;interrupt();setMic(false);face?.pause(true);
 if(window.parent!==window)window.parent.postMessage({type:'mcp-launch',game:'cycles'},location.origin);
 else {cancelIntro.fadeOutMusic();await new Promise(resolve=>setTimeout(resolve,1100));location.replace(new URL('./?mcpLaunch=cycles',location.href));}
}
$('message-form').addEventListener('submit',e=>{e.preventDefault();void send($('message').value);});
$('microphone').onclick=()=>{if(voice.ready)setMic(!micEnabled);};

const exit=window.createExitConfirm({onConfirm:()=>{cancelIntro.pauseMusic();paused=true;interrupt();setMic(false);face?.pause(true);if(window.parent!==window){window.parent.postMessage({type:'mcp-home'},location.origin);}else{leaving=true;location.replace(new URL('./',location.href));}},onCancel:()=>{cancelIntro.resumeMusic();paused=false;status('YOUR TURN');void requestConversationAudio();listen();}});
function showExit(){if(exit.open)return;cancelIntro.pauseMusic();paused=true;interrupt();exit.show();}

window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='mcp-transition-start')cancelIntro.fadeOutMusic();if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='mcp-resume'){document.body.classList.remove('mcp-command','mcp-command-ending');cancelIntro.resumeMusic();paused=false;void requestConversationAudio();face?.pause(false);listen();setBusy(voice.generating);status(voice.generating?'FINISHING PREVIOUS VOICE REQUEST…':voice.ready?'YOUR TURN':'PREPARING MCP VOICE…');}});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!exit.open){e.preventDefault();showExit();}});
window.addEventListener('pagehide',()=>{leaving=true;cancelIntro();interrupt();panelActivity.dispose();face?.dispose();voice.cancel();audioContext?.close();exit.dispose();},{once:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){interrupt({keepVoiceLoading:true});status('TRANSMISSION PAUSED');}else listen();});
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){
 recognition=new Recognition();recognition.lang='en-US';recognition.continuous=false;recognition.interimResults=false;
 recognition.onresult=event=>{if(voice.ready&&!busy&&!paused&&micEnabled&&!leaving)void send(event.results[event.resultIndex][0].transcript);};
 recognition.onend=()=>{recognizing=false;if(!busy)panelActivity.set('');if(micEnabled&&!busy&&!paused&&!leaving)restartTimer=setTimeout(listen,500);};
 recognition.onerror=event=>{if(event.error==='aborted')return;if(event.error==='no-speech')return;unavailable();};
}else{$('microphone').disabled=true;$('microphone').textContent='MIC UNAVAILABLE';}
// Do not initialize WebGL or load the face while the terminal-only introduction is active.
if(!document.body.classList.contains('mcp-terminal')){
 try{const {createMcpFace}=await import('./face.js');face=await createMcpFace($('face'));$('face-fallback').hidden=true;if(leaving)face.dispose();}
 catch(error){console.error('MCP image failed',error);status('MCP DISPLAY UNAVAILABLE');}
}
try{
 const response=await fetch(apiBase+'/api/mcp/status',{signal:AbortSignal.timeout(5000)});const info=await response.json();
 if(leaving)throw new Error('Page closed');
 chatConfigured=!!info.configured;
 setBusy(busy);if(!info.configured){status('CHAT NOT CONFIGURED — API KEY REQUIRED');}
 else{status('WAITING FOR USER');listen();}
}catch{status('RELAY UNAVAILABLE — RELOAD TO RETRY');}

$('face').addEventListener('webglcontextlost',()=>{$('face-fallback').hidden=false;status('FACE ANIMATION PAUSED — VOICE CONTROLS STILL AVAILABLE');});
if(!leaving)voiceReadyPromise=loadVoice();
