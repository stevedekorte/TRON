import {LIGHT_CYCLES} from '../../shared/simulation/config/light-cycles.js';
export const MP_TEAM_VOICE=Object.freeze({samplesByTeam:Object.freeze({GOLD:Object.freeze(['cycle-gold-leader','cycle-gold-leader-alt']),BLUE:Object.freeze(['cycle-blue-leader','cycle-blue-leader-alt']),RED:Object.freeze(['cycle-red-leader','cycle-red-leader-alt']),GREEN:Object.freeze(['cycle-green-leader','cycle-green-leader-alt'])}),delaySeconds:1,laterMatchChance:.2,alternateGainMultiplier:4,gain:.85,gainMultiplierByTeam:Object.freeze({GOLD:4,BLUE:1,RED:4,GREEN:4})});
/** Local team radio: follows the assigned seat, never the spectator target. */
export class MultiplayerTeamVoice {
  constructor(context,master,samples,random=Math.random,chooseRandom=random){Object.assign(this,{context,master,samples,random,chooseRandom});this.reset();}
  stopPlayback(){
    if(!this.voice)return;
    const voice=this.voice;this.voice=null;voice.source.stop();voice.cleanup();
  }
  resetRound(){this.stopPlayback();this.round=null;this.phase=null;this.seat=null;}
  reset(){this.resetRound();this.hasLaunched=false;}
  update(race,multiplayer,audible,solo=false){
    if((multiplayer?!multiplayer.connected:!solo)||!race){this.reset();return;}
    if(this.round!==race.round){this.resetRound();this.round=race.round;}
    const seat=multiplayer?multiplayer.seat:race.playerId;
    const bike=seat==null?null:race.cycles.find(b=>b.id===seat);
    const team=LIGHT_CYCLES.teamNames[bike?.team];
    const choices=MP_TEAM_VOICE.samplesByTeam[team];
    // Count the roster, not survivors: an early crash must not cut off the line.
    const eligible=!!choices&&race.cycles.filter(b=>b.team===bike.team).length===3;
    if(!audible||!eligible||seat!==this.seat||race.phase!=='racing')this.stopPlayback();
    if(race.phase==='racing'&&this.phase==='countdown'&&seat===this.seat&&eligible){
      // Consume one decision per participated launch, even when muted or unavailable.
      const play=!this.hasLaunched||this.random()<MP_TEAM_VOICE.laterMatchChance;
      this.hasLaunched=true;
      const sample=audible&&play?choices[Math.floor(this.chooseRandom()*choices.length)]:null;
      const buffer=this.samples[sample];
      if(buffer){
        const source=this.context.createBufferSource(),gain=this.context.createGain();
        source.buffer=buffer;gain.gain.value=MP_TEAM_VOICE.gain*(sample===choices[0]?MP_TEAM_VOICE.gainMultiplierByTeam[team]:MP_TEAM_VOICE.alternateGainMultiplier);source.connect(gain);gain.connect(this.master);
        const voice={source,cleanup:()=>{source.disconnect();gain.disconnect();if(this.voice===voice)this.voice=null;}};
        source.onended=voice.cleanup;this.voice=voice;
        source.start(this.context.currentTime+MP_TEAM_VOICE.delaySeconds);
      }
    }
    this.phase=race.phase;this.seat=seat;
  }
}
