import {angleDelta,config,GUNNER} from '../game/config.js';
export const TURRET_SERVO={gain:.032,attack:.045,release:.1,baseFrequency:55,frequencyRange:55};
// Measure motor motion relative to the hull, not keys or world heading. Retain
// the measurement between fixed simulation ticks so render frames do not pulse.
export function servoMotion(previous,run){
 const snapshot={time:run.time,yaw:run.turretYaw,pitch:run.aimPitch||0};
 if(!previous||run.time<previous.time||run.time-previous.time>.25)return {...snapshot,speed:0};
 const dt=run.time-previous.time;if(dt<=0)return previous;
 const speed=Math.min(1,Math.hypot(angleDelta(previous.yaw,snapshot.yaw)/(dt*config.turretSpeed),(snapshot.pitch-previous.pitch)/(dt*GUNNER.pitchRate)));
 return {...snapshot,speed};
}
export function createTurretServo(context,destination){
 const gain=context.createGain();gain.gain.value=0;
 const merger=context.createChannelMerger(2);gain.connect(merger,0,0);gain.connect(merger,0,1);merger.connect(destination);
 const motor=context.createOscillator(),harmonic=context.createOscillator(),overtone=context.createGain();
 motor.type='triangle';motor.frequency.value=TURRET_SERVO.baseFrequency;
 harmonic.type='sine';harmonic.frequency.value=TURRET_SERVO.baseFrequency*2.03;overtone.gain.value=.16;
 motor.connect(gain);harmonic.connect(overtone);overtone.connect(gain);motor.start();harmonic.start();
 let motion=null;
 return {
  update(run,playing){
   motion=servoMotion(motion,run);
   const speed=playing&&!run.crushed?motion.speed:0,now=context.currentTime;
   gain.gain.setTargetAtTime(TURRET_SERVO.gain*Math.sqrt(speed),now,speed?TURRET_SERVO.attack:TURRET_SERVO.release);
   const frequency=TURRET_SERVO.baseFrequency+TURRET_SERVO.frequencyRange*speed;
   motor.frequency.setTargetAtTime(frequency,now,.06);harmonic.frequency.setTargetAtTime(frequency*2.03,now,.06);
  },
  reset(){motion=null;gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);},
  dispose(){motor.stop();harmonic.stop();motor.disconnect();harmonic.disconnect();overtone.disconnect();gain.disconnect();merger.disconnect();}
 };
}
