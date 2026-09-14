import {stereoEmitter} from './spatial.js';
let context,source,emitter,filter,start,frame,version=0;
const $=id=>document.getElementById(id);
function stop(){version++;cancelAnimationFrame(frame);source?.stop();source=null;context?.close();context=null;$('status').textContent='Stopped';}
$('stop').onclick=stop;
$('play').onclick=async()=>{
 stop();const current=version;
 const c=context=new AudioContext(),master=c.createGain();master.gain.value=Number($('volume').value);master.connect(c.destination);
 await c.resume();
 try{
  const response=await fetch('/audio/recognizer-flight.wav?v=2');if(!response.ok)throw new Error('Sample unavailable');
  const buffer=await c.decodeAudioData(await response.arrayBuffer());if(current!==version)return;
  emitter=stereoEmitter(c,master);emitter.gain.gain.value=.8;
  filter=c.createBiquadFilter();filter.type='lowpass';filter.connect(emitter.input);
  source=c.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(filter);source.start();start=c.currentTime;
  function update(){
   const t=(c.currentTime-start)%12,x=-80+t/12*160;
   emitter.position(x,25,-20,0);emitter.gain.gain.setTargetAtTime($('wall').checked?.32:.8,c.currentTime,.15);filter.frequency.setTargetAtTime($('wall').checked?550:6500,c.currentTime,.15);
   master.gain.setTargetAtTime(Number($('volume').value),c.currentTime,.04);
   source.playbackRate.setTargetAtTime(343/(343+13.33*x/Math.hypot(x,25,20)),c.currentTime,.1);
   $('status').textContent=x< -10?'Recognizer to your left':x>10?'Recognizer to your right':'Recognizer overhead';
   frame=requestAnimationFrame(update);
  }update();
 }catch(e){if(current===version){stop();$('status').textContent=e.message;}}
};
window.addEventListener('pagehide',stop);
