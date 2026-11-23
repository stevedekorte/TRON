// Arena-wide derez cues: a quiet, non-spatial tone whenever another cycle dies,
// however far away, so the rider can follow the battle by ear. A teammate's
// loss falls (a low, minor two-note droop); an opponent's rises (two bright
// pings, a fifth apart). Synthesized, no samples. The local rider's own crash
// is left to its spatial explosion. Team is relative to the local seat.
export const CYCLE_LOSS_CUE=Object.freeze({
  friendly:Object.freeze({
    notes:Object.freeze([{hz:392,delaySeconds:0,seconds:.22},{hz:311,delaySeconds:.16,seconds:.55,glideToHz:233}]), // G4 → E♭4 sliding to B♭3
    wave:'triangle', lowpassHz:1600, gain:.16, attackSeconds:.012, detuneCents:7,
  }),
  opponent:Object.freeze({
    notes:Object.freeze([{hz:784,delaySeconds:0,seconds:.12},{hz:1175,delaySeconds:.09,seconds:.32}]), // G5 → D6
    wave:'square', lowpassHz:3200, gain:.07, attackSeconds:.004, detuneCents:4,
  }),
  spacingSeconds:.14,   // several losses in one moment play one after another, not stacked
  maxQueued:4,          // beyond this, simultaneous losses share cues
  freshSeconds:.25,     // crashes older than this (late join, resumed tab) stay silent
});

export class CycleLossCue {
  constructor(context,master,config=CYCLE_LOSS_CUE){Object.assign(this,{context,master,config});this.nodes=new Set();this.reset();}
  stopPlayback(){for(const n of [...this.nodes]){try{n.stop();}catch{}n.cleanup();}this.nextAt=0;}
  reset(){this.stopPlayback();this.round=null;this.crashCount=0;this.heard=new Set();}
  /** Returns the kinds started this update ('friendly'|'opponent'). */
  update(race,multiplayer,audible,solo=false){
    if(!race||race.phase==='idle'||(multiplayer?!multiplayer.connected:!solo)){this.reset();return [];}
    // The race object may be a fresh copy each frame; a new round, or a race whose
    // crash list restarted, begins afresh.
    const crashes=race.crashes??[];
    if(this.round!==race.round||crashes.length<this.crashCount){
      this.reset();this.round=race.round;
      for(const c of crashes)this.heard.add(c.id); // already dead when we arrived
    }
    this.crashCount=crashes.length;
    if(!audible)this.stopPlayback();
    const seat=multiplayer?multiplayer.seat:race.playerId,me=seat==null?null:race.cycles.find(b=>b.id===seat);
    const started=[];
    for(const crash of crashes){
      if(this.heard.has(crash.id))continue;
      this.heard.add(crash.id);
      if(!audible||!me||crash.id===me.id||crash.silent||race.time-crash.time>this.config.freshSeconds)continue;
      const team=crash.team??race.cycles.find(b=>b.id===crash.id)?.team;
      const kind=team===me.team?'friendly':'opponent';
      if(this.play(kind))started.push(kind);
    }
    return started;
  }
  play(kind){
    const c=this.context,cue=this.config[kind],now=c.currentTime;
    if(this.nextAt-now>this.config.spacingSeconds*this.config.maxQueued)return false;
    const start=Math.max(now,this.nextAt);this.nextAt=start+this.config.spacingSeconds;this.played=(this.played??0)+1;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cue.lowpassHz;filter.connect(this.master);
    let pending=0;
    for(const note of cue.notes)for(const detune of [-cue.detuneCents,cue.detuneCents]){
      const osc=c.createOscillator(),env=c.createGain(),t0=start+note.delaySeconds,t1=t0+note.seconds;
      osc.type=cue.wave;osc.frequency.setValueAtTime(note.hz,t0);osc.detune.value=detune;
      if(note.glideToHz)osc.frequency.exponentialRampToValueAtTime(note.glideToHz,t1);
      env.gain.setValueAtTime(0,t0);env.gain.linearRampToValueAtTime(cue.gain/2,t0+cue.attackSeconds);
      env.gain.exponentialRampToValueAtTime(1e-4,t1);
      osc.connect(env);env.connect(filter);
      const node={stop:()=>osc.stop(),cleanup:()=>{osc.disconnect();env.disconnect();this.nodes.delete(node);if(--pending===0)filter.disconnect();}};
      osc.onended=node.cleanup;this.nodes.add(node);pending++;
      osc.start(t0);osc.stop(t1+.02);
    }
    return true;
  }
}
