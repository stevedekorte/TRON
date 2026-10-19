import {MultiplayerCountdown} from './multiplayer-countdown.js';
import {gridSpeedNotice} from '../../shared/simulation/cycle-speed-ramp.js';
/** Consume each warning once; never replay missed beeps after mute or a network gap. */
export class CycleSpeedWarning extends MultiplayerCountdown {
 update(race,audible){
  if(!race||race.phase!=='racing'||race.arenaPaused){this.reset();return;}
  if(this.round!==race.round){this.reset();this.round=race.round;}
  const notice=gridSpeedNotice(race),key=notice?.key??null;
  if(key!==this.noticeKey){this.noticeKey=key;if(notice?.launch&&audible)this.tone(true);}
 }
 reset(){super.reset();this.noticeKey=null;}
}
