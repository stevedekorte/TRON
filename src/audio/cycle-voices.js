import { stereoEmitter, doppler } from './spatial.js';
import { LIGHT_CYCLES as C, CYCLE_DIRECTIONS, cycleFraction } from '../game/light-cycles.js';
export const CYCLE_SOUND = Object.freeze({
  stereoHalfWidthMeters: .3, pitchResponseSeconds: .1,
  referenceDistanceMeters: 14, maximumDistanceMeters: 1400,
  driveGain: .22, startupGain: .35, launchGain: .45,
  turnGain: .32, explosionGain: .8, wallGain: .4, turboPitch: 1.28, slowPitch: .85,
});
export function cycleDoppler(r, bike, position, ear) {
  if(!ear||bike?.id===r.playerId)return 1;
  const speed=bike?.alive&&(r.phase==='racing'||bike.escaped)?C.speedMetersPerSecond*(bike.speedMultiplier??1):0;
  const [dx,dz]=bike?.escaped?[-Math.sin(bike.yaw),-Math.cos(bike.yaw)]:CYCLE_DIRECTIONS[bike?.dir??0];
  return doppler({x:position[0],y:position[1],s:-position[2],vx:dx*speed,vs:-dz*speed,vy:0},ear);
}
/** Six spatial engines and short event voices; borrows the game's audio context. */
export class CycleVoices {
  constructor(context, master, samples) {
    Object.assign(this, { context, master, samples });
    this.voices = new Set(); this.engines = new Map(); this.reset();
  }
  position(r, b) {
    const f = cycleFraction(r,b);
    return [r.site.x+(b.previousX+(b.x-b.previousX)*f)*C.cellMeters,
      1, -r.site.s+(b.previousZ+(b.z-b.previousZ)*f)*C.cellMeters];
  }
  voice(name, gain, position, loop=false, bike=null) {
    const buffer=this.samples['cycle-'+name]; if(!buffer)return null;
    const c=this.context, source=c.createBufferSource();
    const emitter=stereoEmitter(c,this.master,CYCLE_SOUND.referenceDistanceMeters,CYCLE_SOUND.stereoHalfWidthMeters);
    for(const panner of emitter.panners)panner.maxDistance=CYCLE_SOUND.maximumDistanceMeters;
    source.buffer=buffer;source.loop=loop;emitter.gain.gain.value=gain;
    source.connect(emitter.input);
    const voice={source,emitter,bike,positionWorld:position,position:(p)=>{
      voice.positionWorld=p;emitter.position(...p,bike?.yaw??-(bike?.dir??0)*Math.PI/2);
    }};
    voice.position(position);this.voices.add(voice);
    source.onended=()=>{source.disconnect();emitter.input.disconnect();emitter.gain.disconnect();for(const p of emitter.panners)p.disconnect();this.voices.delete(voice);};
    source.start();return voice;
  }
  stop(voice) {
    if(!voice)return;
    voice.source.stop();voice.source.onended();voice.source.onended=null;
  }
  stopPlayback() {
    for(const voice of [...this.voices])this.stop(voice);
    this.engines.clear();
  }
  reset() {
    this.stopPlayback();this.race=null;this.round=null;this.phase=null;
    this.turns=new Map();this.crashes=new Set();this.walls=new Set();
  }
  update(r, playing, ear) {
    if(!r||r.phase==='idle'){this.reset();return;}
    if(this.race!==r||this.round!==r.round){
      this.reset();this.race=r;this.round=r.round;
      for(const b of r.cycles)this.turns.set(b.id,b.turns);
    }
    if(!playing){this.stopPlayback();return;}
    if(!this.samples['cycle-drive'])return;
    if(this.phase!==r.phase){
      if(r.phase==='countdown'){
        const b=r.cycles.find(b=>b.id===r.playerId)||r.cycles[0];
        // One dramatic team cue; six identical simultaneous copies overload the mix.
        if(b)this.voice('materialize',CYCLE_SOUND.startupGain,this.position(r,b),false,b);
      }else if(r.phase==='racing')for(const b of r.cycles){
        if(b.alive)this.voice('launch',CYCLE_SOUND.launchGain,this.position(r,b),false,b);
      }
      this.phase=r.phase;
    }
    for(const b of r.cycles){
      const position=this.position(r,b);
      let engine=this.engines.get(b.id);
      if(b.alive&&(!r.arenaPaused||b.id===r.playerId)&&(r.phase==='racing'||b.escaped)){
        if(!engine){engine=this.voice(b.id===r.playerId&&this.samples['cycle-drive-cabin']?'drive-cabin':'drive',CYCLE_SOUND.driveGain,position,true,b);if(engine)this.engines.set(b.id,engine);}
        engine?.position(position);
      }else if(engine){this.stop(engine);this.engines.delete(b.id);}
      if(b.turns!==(this.turns.get(b.id)??b.turns)&&b.alive)this.voice('turn',CYCLE_SOUND.turnGain,position,false,b);
      this.turns.set(b.id,b.turns);
    }
    for(const crash of r.crashes){
      const position=[r.site.x+crash.x*C.cellMeters,1,-r.site.s+crash.z*C.cellMeters];
      const age=r.time-crash.time;
      if(!this.crashes.has(crash.id)){
        this.crashes.add(crash.id);
        if(age<.25)this.voice('explosion',CYCLE_SOUND.explosionGain,position);
      }
      if(age>=C.trailHoldSeconds&&!this.walls.has(crash.id)){
        this.walls.add(crash.id);
        if(age<C.trailHoldSeconds+.25)this.voice('wall-down',CYCLE_SOUND.wallGain,position);
      }
    }
    for(const voice of this.voices){
      if(voice.bike)voice.position(this.position(r,voice.bike));
      const speed=voice.bike?.speedMultiplier??1;
      const drivePitch=speed>=1?1+(CYCLE_SOUND.turboPitch-1)*(speed-1)/(C.turboSpeedMultiplier-1):1-(1-CYCLE_SOUND.slowPitch)*(1-speed)/(1-C.slowSpeedMultiplier);
      const pitch=(voice.source.loop?drivePitch:1)*cycleDoppler(r,voice.bike,voice.positionWorld,ear);
      voice.source.playbackRate.setTargetAtTime(pitch,this.context.currentTime,CYCLE_SOUND.pitchResponseSeconds);
    }
  }
  dispose(){this.reset();}
}
