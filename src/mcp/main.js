window.mcpBooted=true;clearTimeout(window.mcpBootTimer);
import {createMcpFace} from './face.js';
import {McpVoice} from './voice.js';
import {speakSentences} from './speech-queue.js';
import {createVoiceEffects,MCP_VOICE_EFFECTS} from './voice-effects.js';
const $=id=>document.getElementById(id);
const apiBase=(import.meta.env.VITE_MCP_API_BASE||import.meta.env.VITE_JEV_API_BASE||'').replace(/\/$/,'');
let face,recognition,recognizing=false,micEnabled=false,busy=false,leaving=false,paused=false,request,epoch=0,restartTimer;
const history=[];
function unlockAudio(){audioContext??=new AudioContext();void audioContext.resume().catch(()=>{});}
window.addEventListener('pointerdown',unlockAudio);window.addEventListener('keydown',unlockAudio);
let audioContext,audioSource,audioFrame,voiceLoading=false,finishAudio,chatConfigured=false,audioEffects;
let voiceLoadId=0,voiceStarted=0,voiceProgress={stage:'checking'},voiceClock;
const componentName=file=>file?.includes('ort-wasm')?'Voice runtime':file?.includes('speech_encoder')?'Voice encoder':file?.includes('language_model')?'Speech model':file?.includes('conditional_decoder')?'Audio decoder':file?.includes('embed_tokens')?'Text embeddings':'Voice configuration';
const duration=seconds=>seconds<60?`${Math.ceil(seconds)}s`:`${Math.floor(seconds/60)}m ${Math.ceil(seconds%60)}s`;
function renderVoiceProgress(){
 const p=voiceProgress,elapsed=duration((performance.now()-voiceStarted)/1000),bar=$('voice-progress');
 $('voice-status').dataset.stage=p.stage;
 $('download-row').hidden=false;
 if(p.totalBytes){bar.max=p.totalBytes;bar.value=Math.min(p.totalBytes,(p.cachedBytes||0)+(p.downloadedBytes||0));}
 if(p.stage==='downloading'){
  $('voice-status').textContent='TTS — DOWNLOADING';
  const loaded=(p.cachedBytes||0)+(p.downloadedBytes||0),percent=Math.min(100,Math.floor(loaded/p.totalBytes*100));
  $('download-detail').textContent=`${percent}% · ${(loaded/1e6).toFixed(0)} / ${(p.totalBytes/1e6).toFixed(0)} MB · ETA ${p.etaSeconds===null?'calculating…':duration(p.etaSeconds)} · ${componentName(p.component)}`;
 }else if(p.stage==='saving'){$('voice-status').textContent='TTS — SAVING TO DEVICE';$('download-detail').textContent=`${componentName(p.component)} · FINISHING INDEXEDDB CACHE WRITE`;}else if(p.stage==='checking'){$('voice-status').textContent='TTS — CHECKING SAVED FILES';$('download-detail').textContent='REUSING CACHED COMPONENTS';}
 else if(p.stage==='initializing'||p.stage==='conditioning'){
  bar.value=bar.max;$('voice-status').textContent=`TTS — ${p.stage==='initializing'?'INITIALIZING VOICE FROM SAVED FILES':'PREPARING MCP VOICE'} · ${elapsed} ELAPSED`;
  $('download-detail').textContent=(p.downloadedBytes===0?'ALL MODEL FILES REUSED FROM DEVICE — NO DOWNLOAD':'MODEL FILES SAVED TO DEVICE')+' · '+(p.component&&!p.component.startsWith('onnx/')?p.component:'PREPARING SPEECH ENGINE').toUpperCase();
 }else{$('download-row').hidden=true;$('voice-status').textContent=p.stage==='ready'?'TTS — READY':`TTS — ${p.message||'PAUSED — LOAD VOICE TO RESUME'}`;}
}
const voice=new McpVoice(progress=>{if(voiceLoading){voiceProgress={...voiceProgress,...progress};renderVoiceProgress();}});

function stopClonedAudio(){cancelAnimationFrame(audioFrame);audioEffects?.dispose();audioEffects=null;if(audioSource){audioSource.onended=null;audioSource.stop();audioSource.disconnect();}audioSource=null;finishAudio?.();finishAudio=null;}
async function playSamples({samples,sampleRate},token,{processed=false}={}){
 if(token!==epoch)return;
 audioContext??=new AudioContext();await audioContext.resume();if(token!==epoch)return;
 const buffer=audioContext.createBuffer(1,samples.length,sampleRate);buffer.copyToChannel(samples,0);
 const source=audioContext.createBufferSource();source.buffer=buffer;
 const rate=processed?1:MCP_VOICE_EFFECTS.pitchRatio;source.playbackRate.value=rate;
 audioEffects?.dispose();audioEffects=processed?null:createVoiceEffects(audioContext);
 source.connect(audioEffects?.input||audioContext.destination);audioSource=source;
 const started=audioContext.currentTime;status('MCP SPEAKING');face?.speak(true);
 const animate=()=>{if(token!==epoch)return;const offset=Math.floor((audioContext.currentTime-started)*sampleRate*rate);let sum=0,count=0;
  for(let i=offset;i<Math.min(samples.length,offset+1024);i++){sum+=samples[i]*samples[i];count++;}
  face?.level(Math.min(1,Math.sqrt(sum/Math.max(1,count))*7));audioFrame=requestAnimationFrame(animate);
 };
 await new Promise(resolve=>{let tail;finishAudio=()=>{clearTimeout(tail);resolve();};source.onended=()=>{source.disconnect();face?.speak(false);tail=setTimeout(resolve,processed?0:MCP_VOICE_EFFECTS.decaySeconds*1000);};source.start();animate();});
 cancelAnimationFrame(audioFrame);finishAudio=null;audioSource=null;face?.speak(false);
}
async function speakCloned(text,token){
 try{
  await speakSentences({text,generate:chunk=>voice.generate(chunk),play:audio=>playSamples(audio,token),isCurrent:()=>token===epoch,onWaiting:()=>status('MCP GENERATING VOICE…')});
  if(token===epoch){setBusy(false);status('YOUR TURN');restartTimer=setTimeout(listen,350);}
 }catch(error){if(token===epoch){face?.speak(false);setBusy(false);status('MCP CLONED VOICE FAILED — REPLY SHOWN AS TEXT: '+error.message);}}
 finally{if(token!==epoch){setBusy(false);if(!paused&&!leaving)status('YOUR TURN');}}
}
async function loadVoice(){
 if(voiceLoading||busy)return;voiceLoading=true;const loadId=++voiceLoadId;
 voiceStarted=performance.now();voiceProgress={stage:'checking'};renderVoiceProgress();setBusy(busy);
 clearInterval(voiceClock);voiceClock=setInterval(renderVoiceProgress,1000);
 try{await voice.load();if(loadId!==voiceLoadId)return;
  voiceProgress={stage:'ready'};$('load-voice').textContent='MCP VOICE READY';
 }catch(error){if(loadId===voiceLoadId){voiceProgress={stage:'error',message:error.message+' · CLONED VOICE UNAVAILABLE'};$('load-voice').textContent='RETRY MCP VOICE';}}
 finally{if(loadId===voiceLoadId){clearInterval(voiceClock);voiceLoading=false;renderVoiceProgress();setBusy(busy);if(voice.ready){status('VOICE READY — SPEAK OR TYPE TO MCP');listen();}else status('MCP CLONED VOICE UNAVAILABLE — RETRY VOICE LOADING');}}
}
$('load-voice').onclick=loadVoice;
$('voice-sample').onclick=async()=>{
 if(busy)return;stopListening();setBusy(true);const token=++epoch;
 try{audioContext??=new AudioContext();await audioContext.resume();
  const response=await fetch(new URL('audio/mcp-clone-preview-deeper.wav',document.baseURI));if(!response.ok)throw new Error('VOICE SAMPLE UNAVAILABLE');
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
function setBusy(value){busy=value;$('message').disabled=value||!chatConfigured||!voice.ready;$('microphone').disabled=value||!voice.ready||!recognition;$('message').placeholder=voice.ready?'SPEAK OR TYPE YOUR MESSAGE':'WAITING FOR MCP VOICE';$('voice-sample').disabled=value;$('test-voice').disabled=value||!voice.ready;$('load-voice').disabled=value||voice.ready||voiceLoading;}
function stopListening(){clearTimeout(restartTimer);if(recognizing){recognizing=false;try{recognition.abort();}catch{}}}
function listen(){
 if(!chatConfigured||!voice.ready||leaving||paused||busy||document.hidden||!micEnabled||!recognition||recognizing)return;
 try{recognition.start();recognizing=true;status('LISTENING…');}catch{status('MICROPHONE BUSY — CLICK MIC TO RETRY');}
}
function setMic(value){micEnabled=value;$('microphone').setAttribute('aria-pressed',String(value));$('microphone').textContent=value?'MIC OFF':'MIC ON';if(value)listen();else {stopListening();if(!busy)status('TYPE A MESSAGE TO MCP');}}
function interrupt(){
 epoch++;stopClonedAudio();request?.abort();request=null;face?.speak(false);stopListening();
 // An in-flight generation finishes silently. Retain its GPU sessions and
 // block a second generation until it settles instead of terminating the worker.
 setBusy(voice.generating);
}

function speak(text,token){
 if(voice.ready){void speakCloned(text,token);return;}
 setBusy(false);face?.speak(false);
 status(voiceLoading?'MCP CLONED VOICE STILL INITIALIZING — REPLY SHOWN AS TEXT':'MCP CLONED VOICE UNAVAILABLE — LOAD VOICE TO ENABLE SPEECH');
}
async function send(text){
 text=text.trim();if(!text||!chatConfigured||!voice.ready||busy||paused||leaving)return;
 stopListening();setBusy(true);$('heard').textContent=text;$('reply').textContent='';$('message').value='';status('MCP PROCESSING…');
 const token=++epoch;request=new AbortController();const timeout=setTimeout(()=>request?.abort(),50000);
 const sentAt=performance.now(),waiting=setInterval(()=>{if(token===epoch)status(`WAITING FOR GEMINI — ${Math.floor((performance.now()-sentAt)/1000)}s`);},1000);
 try{
  const response=await fetch(apiBase+'/api/mcp/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[...history,{role:'user',content:text}]}),signal:request.signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'MCP CONNECTION UNAVAILABLE');
  if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('MCP RETURNED AN EMPTY REPLY');
  if(token!==epoch||leaving)return;
  history.push({role:'user',content:text},{role:'assistant',content:data.reply});if(history.length>16)history.splice(0,history.length-16);
  clearInterval(waiting);$('reply').textContent=data.reply;speak(data.reply,token);
 }catch(error){if(token===epoch&&!leaving){setBusy(false);const message=error.name==='AbortError'?'GEMINI TIMED OUT — TRY AGAIN':error.message;status(message);$('message').value=text;}}
 finally{clearInterval(waiting);clearTimeout(timeout);if(token===epoch)request=null;}
}
$('message-form').addEventListener('submit',e=>{e.preventDefault();void send($('message').value);});
$('microphone').onclick=()=>{if(voice.ready)setMic(!micEnabled);};

const exit=window.createExitConfirm({onConfirm:()=>{paused=true;interrupt();setMic(false);face?.pause(true);if(window.parent!==window){window.parent.postMessage({type:'mcp-home'},location.origin);}else{leaving=true;location.replace(new URL('./',location.href));}},onCancel:()=>{paused=false;status('YOUR TURN');listen();}});
function showExit(){if(exit.open)return;paused=true;interrupt();exit.show();}

window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='mcp-resume'){paused=false;face?.pause(false);setBusy(voice.generating);status(voice.generating?'FINISHING PREVIOUS VOICE REQUEST…':voice.ready?'YOUR TURN':'PREPARING MCP VOICE…');}});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!exit.open){e.preventDefault();showExit();}});
window.addEventListener('pagehide',()=>{leaving=true;interrupt();face?.dispose();voice.cancel();audioContext?.close();exit.dispose();},{once:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){interrupt({keepVoiceLoading:true});status('TRANSMISSION PAUSED');}else listen();});
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){
 recognition=new Recognition();recognition.lang='en-US';recognition.continuous=false;recognition.interimResults=false;
 recognition.onresult=event=>{if(voice.ready&&!busy&&!paused&&micEnabled&&!leaving)void send(event.results[event.resultIndex][0].transcript);};
 recognition.onend=()=>{recognizing=false;if(micEnabled&&!busy&&!paused&&!leaving)restartTimer=setTimeout(listen,500);};
 recognition.onerror=event=>{if(event.error==='aborted')return;if(event.error==='no-speech')return;setMic(false);status('MICROPHONE UNAVAILABLE — ALLOW ACCESS OR TYPE BELOW');};
}else{$('microphone').disabled=true;$('microphone').textContent='MIC UNAVAILABLE';}
try{face=await createMcpFace($('face'));$('face-fallback').hidden=true;if(leaving)face.dispose();}catch(error){console.error('MCP image failed',error);status('MCP DISPLAY UNAVAILABLE');}
try{
 const response=await fetch(apiBase+'/api/mcp/status',{signal:AbortSignal.timeout(5000)});const info=await response.json();
 if(leaving)throw new Error('Page closed');
 chatConfigured=!!info.configured;
 setBusy(busy);if(!info.configured){status('CHAT NOT CONFIGURED — API KEY REQUIRED');}
 else{status(Recognition?'SPEAK OR TYPE TO MCP':'SPEECH INPUT UNAVAILABLE — TYPE TO MCP');if(Recognition)setMic(true);}
}catch{status('RELAY UNAVAILABLE — RELOAD TO RETRY');}

$('face').addEventListener('webglcontextlost',()=>{$('face-fallback').hidden=false;status('FACE ANIMATION PAUSED — VOICE CONTROLS STILL AVAILABLE');});
if(!leaving)void loadVoice();
