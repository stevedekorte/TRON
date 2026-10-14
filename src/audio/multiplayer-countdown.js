export const MP_COUNTDOWN_SOUND=Object.freeze({
  tickHz:660,launchHz:990,tickSeconds:.09,launchSeconds:.32,
  gain:.18,attackSeconds:.008,releaseSeconds:.025,
});
/** Follow received countdown numbers, never schedule ahead of the referee. */
export class MultiplayerCountdown {
  constructor(context,master){this.context=context;this.master=master;this.voices=new Set();this.reset();}
  tone(launch){
    const c=this.context,t=MP_COUNTDOWN_SOUND,now=c.currentTime;
    const duration=launch?t.launchSeconds:t.tickSeconds;
    const oscillator=c.createOscillator(),gain=c.createGain();
    oscillator.type='sine';oscillator.frequency.value=launch?t.launchHz:t.tickHz;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(t.gain,now+t.attackSeconds);
    gain.gain.setValueAtTime(t.gain,now+duration-t.releaseSeconds);
    gain.gain.linearRampToValueAtTime(0,now+duration);
    oscillator.connect(gain);gain.connect(this.master);
    const voice={oscillator,cleanup:()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(voice);}};
    this.voices.add(voice);oscillator.onended=voice.cleanup;
    oscillator.start(now);oscillator.stop(now+duration);
  }
  update(race,audible){
    if(!race){this.reset();return;}
    if(this.round!==race.round){this.reset();this.round=race.round;}
    if(race.phase==='countdown'){
      const second=Math.ceil(race.remaining);
      if(second>0&&(this.second===null||second<this.second)){
        this.second=second;if(audible)this.tone(false);
      }
    }else if(race.phase==='racing'&&this.phase==='countdown'&&audible)this.tone(true);
    this.phase=race.phase;
  }
  reset(){
    for(const voice of [...this.voices]){voice.oscillator.stop();voice.cleanup();}
    this.round=null;this.second=null;this.phase=null;
  }
}
