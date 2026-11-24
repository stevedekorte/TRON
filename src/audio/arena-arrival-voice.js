// "A warrior is on the mesa": a human has entered the multiplayer arena. In
// multiplayer every arrival in the arena or its queue plays it; in a solo game it
// plays when the arena goes from empty to occupied (see game-app.js).
export const ARENA_ARRIVAL_VOICE=Object.freeze({
 sample:'cycle-warrior-on-mesa',
 caption:'A WARRIOR IS ON THE MESA',
 gain:3.4,
 waitSeconds:4,     // a request waits this long for another announcement to finish, then lapses
 captionSeconds:4,  // HUD caption, shown also when muted or the clip is unavailable
 multiplayerIntervalSeconds:15, // multiplayer: at most one line per 15 s; arrivals inside it are skipped
});
export class ArenaArrivalVoice {
 constructor(context,master,samples){Object.assign(this,{context,master,samples});this.voice=null;this.pending=null;}
 get playing(){return !!this.voice;}
 request(){this.pending=this.context.currentTime;}
 stopPlayback(){if(this.voice){const v=this.voice;this.voice=null;v.source.stop();v.cleanup();}}
 reset(){this.stopPlayback();this.pending=null;}
 /** Returns true when the line starts. `blocked`: another announcement is playing. */
 update(audible,blocked=false){
  if(this.pending===null)return false;
  if(!audible||this.context.currentTime-this.pending>ARENA_ARRIVAL_VOICE.waitSeconds){this.pending=null;return false;}
  const buffer=this.samples[ARENA_ARRIVAL_VOICE.sample];
  if(blocked||!buffer)return false;
  this.pending=null;this.stopPlayback();
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;
  gain.gain.value=ARENA_ARRIVAL_VOICE.gain;source.connect(gain);gain.connect(this.master);
  const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
  source.onended=voice.cleanup;this.voice=voice;source.start();return true;
 }
}
