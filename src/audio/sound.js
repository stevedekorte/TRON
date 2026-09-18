import {createTurretServo} from './turret-servo.js';
import {TANK_EXPLOSION,tankExplosionSamples} from './tank-explosion.js';
import {RECOGNIZER_STARTS} from '../game/recognizer-roster.js';
import {musicCategory,selectMusic,activelyPursued,closeRecognizer,MUSIC_CUES} from './music-selection.js';
import {CARRIER} from '../game/carrier.js';
import endMusicUrl from "../../docs/assets/music/Tron/02 Only Solutions.mp3?url";
import musicUrl from "../../docs/assets/music/Tron/03 We've Got Company Clips/1 recognized 1.mp3?url";
import { lineOfSight } from '../levels/maze.js';
import {stereoEmitter,doppler} from './spatial.js';
import {RECOGNIZER_HIT,recognizerHitSamples} from './recognizer-hit.js';
const musicClips=Object.entries(import.meta.glob("../../docs/assets/music/Tron/03 We've Got Company Clips/*.mp3",{eager:true,query:'?url',import:'default'})).map(([path,url])=>({url,category:musicCategory(path)}));
const files=['tank-drive','recognizer-flight','recognizer-approach','recognizer-explosion','cannon','carrier-drone'];
const keyFiles=Array.from({length:4},(_,i)=>'terminal-key-'+(i+1));
// Film-derived stereo samples; synthesis remains available when a file fails.
export class Sound {
  constructor() {this.context=null;this.muted=false;this.volume=.45;this.samples={};this.keySamples={};this.sampleErrors=[];this.sources=new Set();}
  unlock() {
    if(!this.context)this.init();
    const c=this.context;
    // Both resume and a source start happen inside the trusted input event.
    // This also handles Safari's interrupted state after focus/device changes.
    const resumed=c.state!=='running'&&c.state!=='closed'?c.resume():Promise.resolve();
    const primer=c.createBufferSource();primer.buffer=c.createBuffer(1,1,c.sampleRate);
    primer.connect(c.destination);primer.onended=()=>primer.disconnect();primer.start();
    return resumed;
  }
  outputLevel(){
    if(!this.outputMeter)return 0;
    const samples=this.meterSamples||(this.meterSamples=new Float32Array(this.outputMeter.fftSize));
    this.outputMeter.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
  }
  source(buffer,destination,loop=false,offset=0) {
    const s=this.context.createBufferSource();s.buffer=buffer;s.loop=loop;s.connect(destination);
    this.sources.add(s);s.onended=()=>{s.disconnect();this.sources.delete(s);};s.start(0,offset%buffer.duration);return s;
  }
  init() {
    const c=this.context=new AudioContext();
    this.master=c.createGain();this.master.gain.value=0;
    const limiter=c.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=6;limiter.ratio.value=8;
    this.outputMeter=c.createAnalyser();this.outputMeter.fftSize=512;
    this.master.connect(limiter);limiter.connect(this.outputMeter);this.outputMeter.connect(c.destination);
    this.music=new Audio(musicUrl);this.music.preload='auto';this.music.loop=false;
    this.musicMaster=c.createGain();this.musicMaster.gain.value=0;this.musicMaster.connect(limiter);
    this.musicGain=c.createGain();this.musicGain.gain.value=.55;this.musicGain.connect(this.musicMaster);
    this.musicSource=c.createMediaElementSource(this.music);this.musicSource.connect(this.musicGain);
    this.music.addEventListener('ended',()=>this.nextMusic());
    this.music.addEventListener('error',()=>{this.musicError='Music could not be loaded';});
    this.carrierEmitter=stereoEmitter(c,this.master,600);
    for(const p of this.carrierEmitter.panners)p.maxDistance=15000;
    this.carrierFilter=c.createBiquadFilter();this.carrierFilter.type='lowpass';this.carrierFilter.frequency.value=900;this.carrierFilter.connect(this.carrierEmitter.input);
    this.tankEmitter=stereoEmitter(c,this.master,18);this.tankEmitter.gain.gain.value=1;
    this.turretServo=createTurretServo(c,this.tankEmitter.input);
    this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engineGain.connect(this.tankEmitter.input);
    this.engineFilter=c.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=1200;this.engineFilter.connect(this.engineGain);
    this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=38;this.engine.connect(this.engineFilter);this.engine.start();
    const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=noise.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.04)/1.04;data[i]=last*3;}
    this.noiseBuffer=noise;
    this.voices=RECOGNIZER_STARTS.map((_,i)=>{
      const emitter=stereoEmitter(c,this.master),filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=5800;filter.connect(emitter.input);
      // Duplicate fallback mono to both channels before the stereo emitter.
      const merger=c.createChannelMerger(2),rotor=this.source(noise,merger,true,i*.31);
      rotor.disconnect();rotor.connect(merger,0,0);rotor.connect(merger,0,1);merger.connect(filter);
      const flightGain=c.createGain(),attackGain=c.createGain();flightGain.connect(filter);attackGain.connect(filter);attackGain.gain.value=0;
      return {...emitter,filter,merger,rotor,flightGain,attackGain};
    });
    this.loading=this.loadSamples();
  }
  async loadSamples() {
    await Promise.all([...files,...keyFiles].map(async name=>{
      try {
        const response=await fetch(import.meta.env.BASE_URL+'audio/'+name+'.wav'+(name==='tank-drive'?'?v=5':name==='cannon'||name==='recognizer-flight'||name==='recognizer-explosion'||name.startsWith('terminal-key-')?'?v=2':''));if(!response.ok)throw new Error('HTTP '+response.status);
        const bytes=await response.arrayBuffer();if(this.disposed)return;
        const buffer=await this.context.decodeAudioData(bytes);if(this.disposed)return;
        (name.startsWith('terminal-key-')?this.keySamples:this.samples)[name]=buffer;
      } catch(e){if(!this.disposed)this.sampleErrors.push(name+': '+e.message);}
    }));
    if(this.disposed)return;
    if(this.samples['tank-drive']){this.engine.stop();this.engine.disconnect();this.engineSample=this.source(this.samples['tank-drive'],this.engineFilter,true);}
    if(this.samples['carrier-drone'])this.carrierSample=this.source(this.samples['carrier-drone'],this.carrierFilter,true);
    this.voices.forEach((v,i)=>{
      if(this.samples['recognizer-flight']) {
        v.rotor.stop();v.merger.disconnect();
        v.flight=this.source(this.samples['recognizer-flight'],v.flightGain,true,i*.29);
      }
      if(this.samples['recognizer-approach'])v.attack=this.source(this.samples['recognizer-approach'],v.attackGain,true,i*.37);
    });
  }
  update(run,camera,playing) {
    if(!this.context)return;
    const c=this.context,now=c.currentTime;
    const wasPursued=this.pursued;
    this.pursued=activelyPursued(run);this.musicPlaying=playing;
    if(playing&&!run.crushed){
      const close=closeRecognizer(run,this.closeEncounter);
      if(close&&!this.closeEncounter)this.requestMusic('gotcha');
      this.closeEncounter=close;
      if(wasPursued&&!this.pursued)this.fadeToQuiet();
      else if(this.pursued&&this.musicTransition?.category==='silence'){
        this.musicTransition=null;
        this.musicGain.gain.cancelAndHoldAtTime(now);
        this.musicGain.gain.linearRampToValueAtTime(.55,now+MUSIC_CUES.fadeIn);
      }else if(this.pursued&&!wasPursued&&!this.musicStarted)this.requestMusic('pursued');
      if(!this.pursued&&!this.musicTransition&&!this.music.paused&&!this.music.ended&&Number.isFinite(this.music.duration)&&this.music.duration-this.music.currentTime<=MUSIC_CUES.quietFade)this.fadeToQuiet();
      if(this.music.ended&&!this.musicTransition)this.nextMusic();
      if(this.musicTransition&&now>=this.musicTransition.at){
        const {url}=this.musicTransition;this.musicTransition=null;
        if(url){
          this.startMusic('gameplay',url);
          this.musicGain.gain.setValueAtTime(0,now);
          this.musicGain.gain.linearRampToValueAtTime(.55,now+MUSIC_CUES.fadeIn);
        }else{this.musicGain.gain.setValueAtTime(0,now);this.music.pause();this.musicStarted=false;}
      }
    }
    this.master.gain.setTargetAtTime(this.muted||!playing?0:this.volume,now,.04);
    this.musicMaster.gain.setTargetAtTime(this.muted||(!playing&&this.musicMode!=='terminal')?0:this.volume,now,.04);
    this.turretServo.update(run,playing);
    const speed=Math.abs(run.speed),turn=Math.min(1,Math.abs(run.steer||0));
    if(this.engineSample)this.engineSample.playbackRate.setTargetAtTime(.8+speed*.018+turn*.07,now,.15);
    else this.engine.frequency.setTargetAtTime(33+speed*2.8+turn*5,now,.08);
    this.engineGain.gain.setTargetAtTime(run.crushed?0:((this.engineSample?.12:.025)+speed*(this.engineSample?.008:.0015))*.7*(1+turn*.12),now,.15);
    this.engineFilter.frequency.setTargetAtTime(700+speed*45+turn*180,now,.15);
    const l=c.listener,forward=camera.getWorldDirection(this.forward||(this.forward=camera.position.clone()));
    const up=(this.up||(this.up=camera.position.clone())).set(0,1,0).applyQuaternion(camera.quaternion);
    // Camera is the listener, including cinematic and aerial views.
    const ear={x:camera.position.x,y:camera.position.y,s:-camera.position.z,vx:0,vs:0,vy:0};
    const elapsed=now-(this.lastEar?.time??now);
    if(elapsed>0&&elapsed<.2&&playing&&this.wasPlaying){
      ear.vx=(ear.x-this.lastEar.x)/elapsed;ear.vs=(ear.s-this.lastEar.s)/elapsed;ear.vy=(ear.y-this.lastEar.y)/elapsed;
    }
    this.lastEar={...ear,time:now};this.wasPlaying=playing;
    const carrierX=CARRIER.startX+CARRIER.speed*run.time;
    const carrierDistance=Math.hypot(carrierX-ear.x,CARRIER.s-ear.s,CARRIER.altitude-ear.y);
    this.carrierEmitter.position(carrierX,CARRIER.altitude,-CARRIER.s,0);
    this.carrierEmitter.gain.gain.setTargetAtTime(.65*Math.max(0,1-carrierDistance/14000),now,.4);
    this.carrierFilter.frequency.setTargetAtTime(Math.max(180,900-carrierDistance*.12),now,.4);
    this.carrierSample?.playbackRate.setTargetAtTime(doppler({x:carrierX,s:CARRIER.s,y:CARRIER.altitude,vx:CARRIER.speed,vs:0,vy:0},ear),now,.3);
    this.tankEmitter.position(run.x,1.5,-run.s,run.yaw);
    if(l.positionX){
      l.positionX.value=ear.x;l.positionY.value=ear.y;l.positionZ.value=-ear.s;
      l.forwardX.value=forward.x;l.forwardY.value=forward.y;l.forwardZ.value=forward.z;
      l.upX.value=up.x;l.upY.value=up.y;l.upZ.value=up.z;
    }else{l.setPosition(ear.x,ear.y,-ear.s);l.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);}
    run.recognizers.forEach((e,i)=>{
      const v=this.voices[i],distance=Math.hypot(e.x-ear.x,e.s-ear.s,e.y-ear.y),present=e.state!=='destroyed';
      const clear=present&&distance<900&&lineOfSight({x:e.x,s:e.s,y:e.y},ear);
      const attacking=['fold','drop','recover'].includes(e.state),mix=attacking?.85:e.state==='pursue'?.35:0;
      v.gain.gain.setTargetAtTime(present&&distance<900?(v.flight?.65:.25)*(clear?1:.4):0,now,.12);
      v.filter.frequency.setTargetAtTime(clear?6500:550,now,.2);
      v.flightGain.gain.setTargetAtTime(v.attack?1-mix*.6:1,now,.2);v.attackGain.gain.setTargetAtTime(mix,now,.2);
      const rate=doppler(e,ear)*(1+i*.009);
      v.flight?.playbackRate.setTargetAtTime(rate,now,.12);v.attack?.playbackRate.setTargetAtTime(rate*(e.state==='drop'?1.08:1),now,.12);
      v.position(e.x,e.y,-e.s,e.yaw);
    });
    if(run.impact>.2&&(!this.lastImpact||run.time-this.lastImpact>.25)){this.effect('impact');this.lastImpact=run.time;}
  }
  terminalTone(type){
    if(!this.context||this.context.state!=='running'||this.muted)return;
    const c=this.context,now=c.currentTime,access=type==='access',duration=access?.18:.035;
    if(!access)this.terminalClicks=(this.terminalClicks||0)+1;
    if(!access&&Object.keys(this.keySamples).length){
      const keys=Object.keys(this.keySamples),index=(this.lastKeyIndex+1+Math.floor(Math.random()*Math.max(1,keys.length-1)))%keys.length;
      this.lastKeyIndex=Number.isFinite(index)?index:0;
      const gain=c.createGain();gain.gain.value=this.volume*.16;gain.connect(c.destination);
      const click=this.source(this.keySamples[keys[this.lastKeyIndex]],gain);
      click.onended=()=>{click.disconnect();gain.disconnect();this.sources.delete(click);};return;
    }
    const tone=c.createOscillator(),gain=c.createGain();
    // Separate quiet UI route: game ambience stays muted behind the terminal.
    tone.type=access?'sine':'triangle';
    tone.frequency.setValueAtTime(access?980:650+Math.random()*450,now);
    if(access)tone.frequency.setValueAtTime(1470,now+.085);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(this.volume*(access?.16:.16),now+.002);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    tone.connect(gain);gain.connect(c.destination);tone.start();tone.stop(now+duration+.01);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  }
  effect(type,event) {
    if(!this.context)return;
    if(type==='dataCollected'){this.terminalTone('access');return;}
    if(type==='recognized'){this.recognitionMusic();return;}
    const c=this.context,now=c.currentTime,gain=c.createGain();
    if(type==='hit'&&['recognizer','tank','enemyTank'].includes(event?.subject)){
      if(event.fatal){gain.disconnect();return;}
      const kind=event.subject==='recognizer'?'recognizer':'tank',variant=Math.floor(Math.random()*3),key=kind+variant;
      this.armorHitBuffers??={};
      if(!this.armorHitBuffers[key]){
        const channels=recognizerHitSamples(c.sampleRate,kind,variant),buffer=c.createBuffer(2,channels[0].length,c.sampleRate);
        channels.forEach((a,i)=>buffer.copyToChannel(a,i));this.armorHitBuffers[key]=buffer;
      }
      const emitter=stereoEmitter(c,this.master,kind==='recognizer'?45:30);emitter.gain.gain.value=1;
      emitter.position(event.x,event.y??2,-event.s,0);gain.gain.value=RECOGNIZER_HIT.gain;gain.connect(emitter.input);
      const s=this.source(this.armorHitBuffers[key],gain);
      s.playbackRate.value=RECOGNIZER_HIT.minRate+Math.random()*(RECOGNIZER_HIT.maxRate-RECOGNIZER_HIT.minRate);
      s.onended=()=>{s.disconnect();gain.disconnect();emitter.input.disconnect();emitter.panners.forEach(p=>p.disconnect());emitter.gain.disconnect();this.sources.delete(s);};
      return;
    }
    if(type==='destroyed'&&['tank','enemyTank'].includes(event?.subject)){
      this.tankExplosionBuffers??=[];
      const variant=(this.lastTankExplosionVariant==null?Math.floor(Math.random()*TANK_EXPLOSION.variants):(this.lastTankExplosionVariant+1+Math.floor(Math.random()*(TANK_EXPLOSION.variants-1)))%TANK_EXPLOSION.variants);
      this.lastTankExplosionVariant=variant;
      if(!this.tankExplosionBuffers[variant]){
        const channels=tankExplosionSamples(c.sampleRate,variant),buffer=c.createBuffer(2,channels[0].length,c.sampleRate);
        channels.forEach((a,i)=>buffer.copyToChannel(a,i));this.tankExplosionBuffers[variant]=buffer;
      }
      const emitter=stereoEmitter(c,this.master,TANK_EXPLOSION.refDistance);emitter.gain.gain.value=1;
      emitter.position(event.x,event.y??0,-event.s,event.yaw||0);
      gain.gain.value=TANK_EXPLOSION.gain;gain.connect(emitter.input);
      const source=this.source(this.tankExplosionBuffers[variant],gain);
      source.playbackRate.value=TANK_EXPLOSION.minRate+Math.random()*(TANK_EXPLOSION.maxRate-TANK_EXPLOSION.minRate);
      source.onended=()=>{source.disconnect();gain.disconnect();emitter.input.disconnect();emitter.panners.forEach(p=>p.disconnect());emitter.gain.disconnect();this.sources.delete(source);};
      return;
    }
    if(type==='destroyed'&&event&&!['tank','enemyTank'].includes(event.subject)&&this.samples['recognizer-explosion']){
      const emitter=stereoEmitter(c,this.master,35);
      emitter.gain.gain.value=1;
      emitter.position(event.x,event.y,-event.s,event.yaw||0);
      gain.gain.value=.9;gain.connect(emitter.input);
      const s=this.source(this.samples['recognizer-explosion'],gain);
      s.onended=()=>{s.disconnect();gain.disconnect();emitter.input.disconnect();emitter.panners.forEach(p=>p.disconnect());emitter.gain.disconnect();this.sources.delete(s);};
      return;
    }
    if(type==='enemyShot'){
      const p=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=20;p.maxDistance=12000;p.rolloffFactor=1.2;
      p.positionX.value=event.x;p.positionY.value=event.y;p.positionZ.value=-event.s;gain.connect(p);p.connect(this.master);
      gain.gain.value=.65;
      if(this.samples.cannon){const s=this.source(this.samples.cannon,gain);s.onended=()=>{s.disconnect();gain.disconnect();p.disconnect();this.sources.delete(s);};}else{gain.disconnect();p.disconnect();}
      return;
    }
    gain.connect(this.master);
    if(type==='shot'&&this.samples.cannon){
      gain.gain.value=.65;const s=this.source(this.samples.cannon,gain);s.playbackRate.value=1;
      s.onended=()=>{s.disconnect();gain.disconnect();this.sources.delete(s);};return;
    }
    if(type==='destroyed'||type==='impact'){
      const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=type==='destroyed'?1300:300;f.connect(gain);
      gain.gain.setValueAtTime(type==='destroyed'?.7:.2,now);gain.gain.exponentialRampToValueAtTime(.001,now+.8);
      const s=this.source(this.noiseBuffer,f);s.stop(now+.85);s.onended=()=>{s.disconnect();f.disconnect();gain.disconnect();this.sources.delete(s);};return;
    }
    const o=c.createOscillator();o.type=type==='shot'?'sawtooth':'sine';const freq=type==='shot'?320:820;
    o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(freq*.2,now+.3);
    gain.gain.setValueAtTime(.13,now);gain.gain.exponentialRampToValueAtTime(.001,now+.35);
    o.connect(gain);o.start();o.stop(now+.4);o.onended=()=>{o.disconnect();gain.disconnect();};
  }
  fadeMusic(progress){
    this.musicTransition=null;this.pursued=false;
    if(!this.musicGain)return;
    const gain=this.musicGain.gain,now=this.context.currentTime;
    this.deathMusicGain??=gain.value;
    const level=this.deathMusicGain*Math.pow(1-Math.max(0,Math.min(1,progress)),2);
    gain.cancelScheduledValues(now);
    if(progress>=1)gain.setValueAtTime(0,now);
    else gain.setTargetAtTime(level,now,.02);
  }
  fadeToQuiet(){
    if(!this.music||this.musicMode!=='gameplay'||this.musicTransition?.category==='silence')return;
    const now=this.context.currentTime,gain=this.musicGain.gain;
    const remaining=this.music.duration-this.music.currentTime;
    const duration=Number.isFinite(remaining)?Math.min(MUSIC_CUES.quietFade,Math.max(0,remaining)):MUSIC_CUES.quietFade;
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(0,now+duration);
    this.musicTransition={url:null,category:'silence',at:now+duration};
  }
  nextMusic(){
    if(this.disposed||this.musicMode!=='gameplay'||!this.musicPlaying||this.musicTransition)return;
    if(this.pursued)this.requestMusic('pursued');
  }
  recognitionMusic(){
    if(this.closeEncounter||this.musicTransition?.category==='gotcha')return;
    // One phrase covers overlapping recognitions, rather than restarting constantly.
    if(this.musicCategory==='recognized'&&!this.music.ended&&!this.music.paused)return;
    this.requestMusic('recognized');
  }
  requestMusic(category){
    if(!this.music||this.musicMode!=='gameplay'||this.disposed||this.musicTransition?.category===category)return;
    const url=selectMusic(musicClips,category,this.currentMusicUrl);if(!url)return;
    const now=this.context.currentTime,gain=this.musicGain.gain;
    gain.cancelAndHoldAtTime(now);
    const duration=this.music.ended?0:MUSIC_CUES.fadeOut;
    gain.linearRampToValueAtTime(0,now+duration);
    this.musicTransition={url,category,at:now+duration};
  }
  startMusic(mode='gameplay',clipUrl=null){
    if(!this.music)return;
    const url=clipUrl||(mode==='terminal'?endMusicUrl:musicUrl);
    if(this.currentMusicUrl!==url)this.music.src=url;
    this.currentMusicUrl=url;this.musicCategory=musicClips.find(c=>c.url===url)?.category||null;
    if(mode==='terminal')this.musicTransition=null;
    this.musicMode=mode;this.musicError=null;this.deathMusicGain=null;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setValueAtTime(.55,this.context.currentTime);
    this.music.currentTime=0;this.musicStarted=true;this.resumeMusic();
  }
  resumeMusic(){
    if(this.musicStarted&&!this.music.ended&&!this.disposed)this.music.play().catch(e=>{this.musicError=e.message;});
  }
  reset(){this.turretServo?.reset();this.musicTransition=null;this.closeEncounter=false;this.pursued=false;this.music?.pause();if(this.music)this.music.currentTime=0;this.musicStarted=false;this.musicMode=null;this.lastImpact=0;this.lastEar=null;this.wasPlaying=false;for(const s of this.sources)if(!s.loop)s.stop();}
  silence(){this.music?.pause();if(this.context){this.master.gain.setTargetAtTime(0,this.context.currentTime,.02);this.musicMaster.gain.setTargetAtTime(0,this.context.currentTime,.02);}}
  dispose(){this.disposed=true;this.turretServo?.dispose();this.music?.pause();this.music?.removeAttribute('src');this.music?.load();this.musicSource?.disconnect();this.musicGain?.disconnect();this.musicMaster?.disconnect();this.context?.close();this.sources.clear();}
}
