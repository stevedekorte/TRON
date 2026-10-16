import {LIGHT_CYCLES} from '../../shared/simulation/config/light-cycles.js';
export const MP_TEAM_VOICE=Object.freeze({team:'BLUE',sample:'cycle-blue-leader',delaySeconds:1,gain:.85});
/** Local team radio: follows the assigned seat, never the spectator target. */
export class MultiplayerTeamVoice {
  constructor(context,master,samples){Object.assign(this,{context,master,samples});this.reset();}
  stopPlayback(){
    if(!this.voice)return;
    const voice=this.voice;this.voice=null;voice.source.stop();voice.cleanup();
  }
  reset(){this.stopPlayback();this.round=null;this.phase=null;this.seat=null;}
  update(race,multiplayer,audible){
    if(!multiplayer?.connected||!race){this.reset();return;}
    if(this.round!==race.round){this.reset();this.round=race.round;}
    const seat=multiplayer.seat;
    const bike=seat==null?null:race.cycles.find(b=>b.id===seat);
    const eligible=LIGHT_CYCLES.teamNames[bike?.team]===MP_TEAM_VOICE.team;
    if(!audible||!eligible||seat!==this.seat||race.phase!=='racing')this.stopPlayback();
    if(race.phase==='racing'&&this.phase==='countdown'&&seat===this.seat&&eligible&&audible){
      const buffer=this.samples[MP_TEAM_VOICE.sample];
      if(buffer){
        const source=this.context.createBufferSource(),gain=this.context.createGain();
        source.buffer=buffer;gain.gain.value=MP_TEAM_VOICE.gain;source.connect(gain);gain.connect(this.master);
        const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
        source.onended=voice.cleanup;this.voice=voice;
        source.start(this.context.currentTime+MP_TEAM_VOICE.delaySeconds);
      }
    }
    this.phase=race.phase;this.seat=seat;
  }
}
