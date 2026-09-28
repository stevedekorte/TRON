export const CYCLE_ENTRY_CUES=Object.freeze([
  {name:'prepare-transport',at:9.3,gain:.85},
  {name:'transport',at:11.86,gain:.65},
  {name:'have-transport',at:14.9,gain:.85},
  {name:'entry-startup',at:16.3,gain:.6},
]);
/** Intro time is owned by the app, so standby can resume even mid-sentence. */
export class CycleOpeningAudio {
  constructor(context,master,samples){Object.assign(this,{context,master,samples});this.active=new Map();}
  update(seconds,playing){
    for(const cue of CYCLE_ENTRY_CUES){
      const buffer=this.samples['cycle-'+cue.name],offset=seconds===null?-1:seconds-cue.at;
      const audible=playing&&buffer&&offset>=0&&offset<buffer.duration;
      const current=this.active.get(cue.name);
      if(!audible&&current){current.source.stop();current.cleanup();}
      else if(audible&&!current){
        const source=this.context.createBufferSource(),gain=this.context.createGain();
        source.buffer=buffer;gain.gain.value=cue.gain;source.connect(gain);gain.connect(this.master);
        const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.active.get(cue.name)===voice)this.active.delete(cue.name);}};
        source.onended=voice.cleanup;this.active.set(cue.name,voice);source.start(0,offset);
      }
    }
  }
  reset(){for(const voice of [...this.active.values()]){voice.source.stop();voice.cleanup();}}
}
