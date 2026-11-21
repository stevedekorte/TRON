import {gridSpeedAt} from '../../shared/simulation/cycle-speed-ramp.js';
// Arena announcer milestones, in the same voice and treatment as the illegal-exit line.
export const CYCLE_SPEED_VOICE=Object.freeze({
 gain:3.4,
 milestones:Object.freeze([
  Object.freeze({multiplier:1.5,sample:'cycle-arena-speed-150'}),
  Object.freeze({multiplier:2,sample:'cycle-arena-speed-200'}),
  Object.freeze({multiplier:2.5,sample:'cycle-arena-speed-250'}),
  Object.freeze({multiplier:3,sample:'cycle-arena-speed-300'}),
  Object.freeze({multiplier:3.5,sample:'cycle-arena-speed-350'}),
  Object.freeze({multiplier:4,sample:'cycle-arena-speed-400'}),
 ]),
});
const reached=race=>{
 const speed=gridSpeedAt(race.elapsed??0);let level=0;
 for(const [i,m] of CYCLE_SPEED_VOICE.milestones.entries())if(speed+1e-9>=m.multiplier)level=i+1;
 return level;
};
/** Everyone in the arena hears each milestone once per round; no backlog after joins, mutes or pauses. */
export class CycleSpeedVoice {
 constructor(context,master,samples){Object.assign(this,{context,master,samples});this.reset();}
 get playing(){return !!this.voice;}
 stopPlayback(){if(this.voice){const v=this.voice;this.voice=null;v.source.stop();v.cleanup();}}
 reset(){this.stopPlayback();this.round=null;this.level=0;}
 /** Returns true when a line starts. `blocked` skips (but consumes) a milestone while another announcement plays. */
 update(race,active,audible,blocked=false){
  if(!race||!active){this.reset();return false;}
  const level=reached(race);
  if(this.round!==race.round){this.reset();this.round=race.round;this.level=level;return false;}
  if(!audible)this.stopPlayback();
  if(level<=this.level){this.level=level;return false;}
  this.level=level;
  const buffer=this.samples[CYCLE_SPEED_VOICE.milestones[level-1].sample];
  if(race.phase!=='racing'||!audible||blocked||!buffer)return false;
  this.stopPlayback();
  const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;
  gain.gain.value=CYCLE_SPEED_VOICE.gain;source.connect(gain);gain.connect(this.master);
  const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
  source.onended=voice.cleanup;this.voice=voice;source.start();return true;
 }
}
