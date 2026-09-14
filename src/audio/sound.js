import {CARRIER} from '../game/carrier.js';
import musicUrl from "../../docs/assets/music/Tron/03 We've Got Company.mp3?url";
import { RECOGNIZER_STARTS, lineOfSight } from '../levels/maze.js';
import {stereoEmitter,doppler} from './spatial.js';
const files=['tank-drive','recognizer-flight','recognizer-approach','cannon','carrier-rumble'];
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
    this.music=new Audio(musicUrl);this.music.preload='auto';
    this.musicGain=c.createGain();this.musicGain.gain.value=.55;this.musicGain.connect(this.master);
    this.musicSource=c.createMediaElementSource(this.music);this.musicSource.connect(this.musicGain);
    this.music.addEventListener('error',()=>{this.musicError='Music could not be loaded';});
    this.carrierEmitter=stereoEmitter(c,this.master,600);
    for(const p of this.carrierEmitter.panners)p.maxDistance=15000;
    this.carrierFilter=c.createBiquadFilter();this.carrierFilter.type='lowpass';this.carrierFilter.frequency.value=900;this.carrierFilter.connect(this.carrierEmitter.input);
    this.tankEmitter=stereoEmitter(c,this.master,18);this.tankEmitter.gain.gain.value=1;
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
        const response=await fetch('/audio/'+name+'.wav'+(name==='tank-drive'?'?v=3':name==='cannon'||name.startsWith('terminal-key-')?'?v=2':''));if(!response.ok)throw new Error('HTTP '+response.status);
        const bytes=await response.arrayBuffer();if(this.disposed)return;
        const buffer=await this.context.decodeAudioData(bytes);if(this.disposed)return;
        (name.startsWith('terminal-key-')?this.keySamples:this.samples)[name]=buffer;
      } catch(e){if(!this.disposed)this.sampleErrors.push(name+': '+e.message);}
    }));
    if(this.disposed)return;
    if(this.samples['tank-drive']){this.engine.stop();this.engine.disconnect();this.engineSample=this.source(this.samples['tank-drive'],this.engineFilter,true);}
    if(this.samples['carrier-rumble'])this.carrierSample=this.source(this.samples['carrier-rumble'],this.carrierFilter,true);
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
    this.master.gain.setTargetAtTime(this.muted||!playing?0:this.volume,now,.04);
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
    const c=this.context,now=c.currentTime,gain=c.createGain();
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
  startMusic(){
    if(!this.music)return;
    this.music.currentTime=0;this.musicStarted=true;this.resumeMusic();
  }
  resumeMusic(){
    if(this.musicStarted&&!this.music.ended&&!this.disposed)this.music.play().catch(e=>{this.musicError=e.message;});
  }
  reset(){this.music?.pause();if(this.music)this.music.currentTime=0;this.musicStarted=false;this.lastImpact=0;this.lastEar=null;this.wasPlaying=false;for(const s of this.sources)if(!s.loop)s.stop();}
  silence(){this.music?.pause();if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.02);}
  dispose(){this.disposed=true;this.music?.pause();this.music?.removeAttribute('src');this.music?.load();this.musicSource?.disconnect();this.musicGain?.disconnect();this.context?.close();this.sources.clear();}
}
