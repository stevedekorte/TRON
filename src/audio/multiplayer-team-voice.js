import {LIGHT_CYCLES} from '../../shared/simulation/config/light-cycles.js';
export const MP_TEAM_VOICE=Object.freeze({samplesByTeam:Object.freeze({GOLD:'cycle-gold-leader',BLUE:'cycle-blue-leader',RED:'cycle-red-leader',GREEN:'cycle-green-leader'}),delaySeconds:1,laterMatchChance:.2,gain:.85,gainMultiplierByTeam:Object.freeze({GOLD:4,BLUE:1,RED:4,GREEN:4})});
/** Local team radio: follows the assigned seat, never the spectator target. */
export class MultiplayerTeamVoice {
  constructor(context,master,samples,random=Math.random){Object.assign(this,{context,master,samples,random});this.reset();}
  stopPlayback(){
    if(!this.voice)return;
    const voice=this.voice;this.voice=null;voice.source.stop();voice.cleanup();
  }
  resetRound(){this.stopPlayback();this.round=null;this.phase=null;this.seat=null;}
  reset(){this.resetRound();this.hasLaunched=false;}
  update(race,multiplayer,audible){
    if(!multiplayer?.connected||!race){this.reset();return;}
    if(this.round!==race.round){this.resetRound();this.round=race.round;}
    const seat=multiplayer.seat;
    const bike=seat==null?null:race.cycles.find(b=>b.id===seat);
    const team=LIGHT_CYCLES.teamNames[bike?.team];
    const sample=MP_TEAM_VOICE.samplesByTeam[team];
    const eligible=!!sample;
    if(!audible||!eligible||seat!==this.seat||race.phase!=='racing')this.stopPlayback();
    if(race.phase==='racing'&&this.phase==='countdown'&&seat===this.seat&&eligible){
      // Consume one decision per participated launch, even when muted or unavailable.
      const play=!this.hasLaunched||this.random()<MP_TEAM_VOICE.laterMatchChance;
      this.hasLaunched=true;
      const buffer=audible&&play?this.samples[sample]:null;
      if(buffer){
        const source=this.context.createBufferSource(),gain=this.context.createGain();
        source.buffer=buffer;gain.gain.value=MP_TEAM_VOICE.gain*MP_TEAM_VOICE.gainMultiplierByTeam[team];source.connect(gain);gain.connect(this.master);
        const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
        source.onended=voice.cleanup;this.voice=voice;
        source.start(this.context.currentTime+MP_TEAM_VOICE.delaySeconds);
      }
    }
    this.phase=race.phase;this.seat=seat;
  }
}
