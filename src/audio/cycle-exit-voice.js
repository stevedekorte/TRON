export const CYCLE_EXIT_VOICE=Object.freeze({sample:'cycle-illegal-exit',gain:3.4});
/** Local assigned rider only; spectator follow targets never select announcements. */
export class CycleExitVoice {
 constructor(context,master,samples){Object.assign(this,{context,master,samples});this.reset();}
 stopPlayback(){if(this.voice){const v=this.voice;this.voice=null;v.source.stop();v.cleanup();}}
 reset(){this.stopPlayback();this.round=null;this.seat=null;this.revision=0;}
 update(race,multiplayer,audible,solo=false){
  if(!race||(multiplayer?!multiplayer.connected:!solo)){this.reset();return false;}
  const seat=multiplayer?multiplayer.seat:race.playerId;
  const bike=seat==null?null:race.cycles.find(b=>b.id===seat),revision=bike?.escapeRevision??0;
  if(this.round!==race.round||seat!==this.seat){this.reset();this.round=race.round;this.seat=seat;this.revision=revision;return false;}
  if(!audible)this.stopPlayback();
  const exited=revision>this.revision;this.revision=revision;
  const buffer=this.samples[CYCLE_EXIT_VOICE.sample];
  if(!exited||!audible||!buffer)return false;
  this.stopPlayback();
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;
  gain.gain.value=CYCLE_EXIT_VOICE.gain;source.connect(gain);gain.connect(this.master);
  const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
  source.onended=voice.cleanup;this.voice=voice;source.start();return true;
 }
}
