// Arena announcer: "One opponent left", in the same voice as the speed and illegal-exit lines.
export const CYCLE_OPPONENT_VOICE=Object.freeze({sample:'cycle-one-opponent-left',gain:3.4});
const opponents=(race,bike)=>race.cycles.filter(b=>b.alive&&!b.escaped&&b.team!==bike.team).length;
/** The local living rider (solo player or assigned MP seat) hears it once per round, when opponents drop to one. */
export class CycleOpponentVoice {
 constructor(context,master,samples){Object.assign(this,{context,master,samples});this.reset();}
 get playing(){return !!this.voice;}
 stopPlayback(){if(this.voice){const v=this.voice;this.voice=null;v.source.stop();v.cleanup();}}
 reset(){this.stopPlayback();this.round=null;this.seat=null;this.count=null;this.done=false;}
 /** Returns true when the line starts. `blocked` consumes the moment while another announcement plays. */
 update(race,multiplayer,audible,solo=false,blocked=false){
  if(!race||(multiplayer?!multiplayer.connected:!solo)){this.reset();return false;}
  const seat=multiplayer?multiplayer.seat:race.playerId,bike=seat==null?null:race.cycles.find(b=>b.id===seat);
  const count=bike?opponents(race,bike):null;
  if(this.round!==race.round||seat!==this.seat){this.reset();this.round=race.round;this.seat=seat;this.count=count;this.done=count!==null&&count<=1;return false;}
  if(!audible)this.stopPlayback();
  const previous=this.count;this.count=count;
  if(this.done||count!==1||!(previous>1))return false;
  this.done=true;
  const buffer=this.samples[CYCLE_OPPONENT_VOICE.sample];
  if(race.phase!=='racing'||!bike?.alive||bike.escaped||!audible||blocked||!buffer)return false;
  this.stopPlayback();
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;
  gain.gain.value=CYCLE_OPPONENT_VOICE.gain;source.connect(gain);gain.connect(this.master);
  const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
  source.onended=voice.cleanup;this.voice=voice;source.start();return true;
 }
}
