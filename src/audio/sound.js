const SURFACE_HIT_SOUND=Object.freeze({referenceDistanceMeters:18,maximumDistanceMeters:12000,rolloff:1.2});
import {CycleOpeningAudio, CYCLE_ENTRY_CUES} from './cycle-opening.js';
import { CycleVoices } from './cycle-voices.js';
import { MusicDirector } from './music-director.js';
import { RecognizerVoices } from './recognizer-voices.js';
import { DEFAULT_WORLD, worldFor } from '../levels/scenario.js';
import { TELEPORT_SOUND, teleportSamples } from './teleport.js';
import endOfLineUrl from '../../docs/references/dialog/END OF LINE.mp3?url';
import cluCannonUrl from '../../docs/references/sounds/clue fire.mp3?url';
import { createTurretServo } from './turret-servo.js';
import { TANK_EXPLOSION, tankExplosionSamples } from './tank-explosion.js';
import { RECOGNIZER_STARTS, recognizerStarts } from '../game/recognizer-roster.js';
import { CARRIER, carrierFor } from '../game/carrier.js';
import { stereoEmitter, doppler } from './spatial.js';
import { RECOGNIZER_HIT, recognizerHitSamples } from './recognizer-hit.js';
const files = [
  'tank-drive',
  'recognizer-flight',
  'recognizer-approach',
  'recognizer-explosion',
  'cannon',
  'clu-cannon',
  'carrier-drone',
  'data-ring-close',
  'data-ring-open',
];
const keyFiles = Array.from({ length: 4 }, (_, i) => 'terminal-key-' + (i + 1));
// Film-derived stereo samples; synthesis remains available when a file fails.
export class Sound {
  constructor(world = DEFAULT_WORLD) {
    this.world = world;
    this.musicDirector = new MusicDirector(world);
    this.context = null;
    this.muted = false;
    this.volume = 0.45;
    this.samples = {};
    this.keySamples = {};
    this.sampleErrors = [];
    this.sources = new Set();
  }
  async preload(){
    if(!this.context)this.init();
    await Promise.all([this.loading,this.loadCycleSamples(),this.musicDirector.preload()]);
  }
  unlock() {
    if (!this.context) this.init();
    const c = this.context;
    // Both resume and a source start happen inside the trusted input event.
    // This also handles Safari's interrupted state after focus/device changes.
    const resumed = c.state !== 'running' && c.state !== 'closed' ? c.resume() : Promise.resolve();
    const primer = c.createBufferSource();
    primer.buffer = c.createBuffer(1, 1, c.sampleRate);
    primer.connect(c.destination);
    primer.onended = () => primer.disconnect();
    primer.start();
    return resumed;
  }
  endOfLine() {
    const buffer = this.samples['end-of-line'];
    if (!this.context || !buffer) return;
    // The gameplay master is silent on the terminal; this bus follows mute.
    const gain = this.context.createGain();
    gain.gain.value = 0.9;
    gain.connect(this.musicDirector.musicMaster);
    const source = this.source(buffer, gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.sources.delete(source);
    };
  }
  outputLevel() {
    if (!this.outputMeter) return 0;
    const samples =
      this.meterSamples || (this.meterSamples = new Float32Array(this.outputMeter.fftSize));
    this.outputMeter.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
  }
  source(buffer, destination, loop = false, offset = 0) {
    const s = this.context.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    s.connect(destination);
    this.sources.add(s);
    s.onended = () => {
      s.disconnect();
      this.sources.delete(s);
    };
    s.start(0, offset % buffer.duration);
    return s;
  }
  init() {
    const c = (this.context = new AudioContext({latencyHint:'interactive'}));
    this.master = c.createGain();
    this.master.gain.value = 0;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    this.outputMeter = c.createAnalyser();
    this.outputMeter.fftSize = 512;
    this.master.connect(limiter);
    limiter.connect(this.outputMeter);
    this.outputMeter.connect(c.destination);
    this.musicDirector.init(c, limiter);
    this.carrierEmitter = stereoEmitter(c, this.master, 600);
    for (const p of this.carrierEmitter.panners) p.maxDistance = 15000;
    this.carrierFilter = c.createBiquadFilter();
    this.carrierFilter.type = 'lowpass';
    this.carrierFilter.frequency.value = 900;
    this.carrierFilter.connect(this.carrierEmitter.input);
    this.tankEmitter = stereoEmitter(c, this.master, 18);
    this.tankEmitter.gain.gain.value = 1;
    this.turretServo = createTurretServo(c, this.tankEmitter.input);
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.tankEmitter.input);
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 1200;
    this.engineFilter.connect(this.engineGain);
    this.engine = c.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 38;
    this.engine.connect(this.engineFilter);
    this.engine.start();
    const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) / 1.04;
      data[i] = last * 3;
    }
    this.noiseBuffer = noise;
    this.recognizerVoices = new RecognizerVoices({
      context: c,
      master: this.master,
      world: this.world,
      samples: this.samples,
      noiseBuffer: this.noiseBuffer,
      source: this.source.bind(this),
    });
    this.cycleOpeningAudio = new CycleOpeningAudio(c, this.master, this.samples);
    this.cycleVoices = new CycleVoices(c, this.master, this.samples);
    this.loading = this.loadSamples();
  }
  async loadSamples() {
    await Promise.all(
      [...files, ...keyFiles, 'end-of-line'].map(async (name) => {
        try {
          const response = await fetch(
            name === 'end-of-line'
              ? endOfLineUrl
              : name === 'clu-cannon'
                ? cluCannonUrl
              : import.meta.env.BASE_URL +
                  'audio/' +
                  name +
                  '.wav' +
                  (name === 'tank-drive'
                    ? '?v=5'
                    : name === 'cannon' ||
                        name === 'recognizer-flight' ||
                        name === 'recognizer-explosion' ||
                        name.startsWith('terminal-key-')
                      ? '?v=2'
                      : ''),
          );
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const bytes = await response.arrayBuffer();
          if (this.disposed) return;
          const buffer = await this.context.decodeAudioData(bytes);
          if (this.disposed) return;
          (name.startsWith('terminal-key-') ? this.keySamples : this.samples)[name] = buffer;
        } catch (e) {
          if (!this.disposed) this.sampleErrors.push(name + ': ' + e.message);
        }
      }),
    );
    if (this.disposed) return;
    if (this.samples['tank-drive']) {
      this.engine.stop();
      this.engine.disconnect();
      this.engineSample = this.source(this.samples['tank-drive'], this.engineFilter, true);
    }
    if (this.samples['carrier-drone'])
      this.carrierSample = this.source(this.samples['carrier-drone'], this.carrierFilter, true);
    this.recognizerVoices.loadSamples();
  }

  loadCycleSamples() {
    if(!this.context)return Promise.resolve();
    return this.cycleLoading ??= Promise.all(['materialize','startup','launch','drive','drive-cabin','turn','explosion','wall-down',...CYCLE_ENTRY_CUES.map(cue=>cue.name)].map(async name=>{
      try {
        const response=await fetch(import.meta.env.BASE_URL+'audio/cycle-'+name+'.wav'+(name==='drive-cabin'?'?v=4':['drive','turn','explosion'].includes(name)?'?v=2':''));
        if(!response.ok)throw new Error('HTTP '+response.status);
        const bytes=await response.arrayBuffer();if(this.disposed)return;
        const buffer=await this.context.decodeAudioData(bytes);if(!this.disposed)this.samples['cycle-'+name]=buffer;
      }catch(e){if(!this.disposed)this.sampleErrors.push('cycle-'+name+': '+e.message);}
    })).then(()=>{this.cycleSamplesReady=true;});
  }
  update(run, camera, playing) {
    const CARRIER = carrierFor(this.world);
    if (!this.context) return;
    const c = this.context,
      now = c.currentTime;
    this.musicDirector.updateMusic(run, camera, playing);
    this.master.gain.setTargetAtTime(this.muted || !playing ? 0 : this.volume, now, 0.04);
    this.musicDirector.musicMaster.gain.setTargetAtTime(
      this.muted || (!playing && this.musicDirector.musicMode !== 'terminal') ? 0 : this.volume,
      now,
      0.04,
    );
    const cycleMode=run.playerVehicle==='cycle';
    if(run.cycleRace?.phase!=='idle')this.loadCycleSamples();
    this.turretServo.update(run, playing&&!cycleMode);
    const speed = Math.abs(run.speed),
      turn = Math.min(1, Math.abs(run.steer || 0));
    if (this.engineSample)
      this.engineSample.playbackRate.setTargetAtTime(0.8 + speed * 0.018 + turn * 0.07, now, 0.15);
    else this.engine.frequency.setTargetAtTime(33 + speed * 2.8 + turn * 5, now, 0.08);
    this.engineGain.gain.setTargetAtTime(
      cycleMode || run.crushed || run.teleport || run.transferActive
        ? 0
        : ((this.engineSample ? 0.12 : 0.025) + speed * (this.engineSample ? 0.008 : 0.0015)) *
            0.7 *
            (1 + turn * 0.12),
      now,
      0.15,
    );
    this.engineFilter.frequency.setTargetAtTime(700 + speed * 45 + turn * 180, now, 0.15);
    const l = c.listener,
      forward = camera.getWorldDirection(this.forward || (this.forward = camera.position.clone()));
    const up = (this.up || (this.up = camera.position.clone()))
      .set(0, 1, 0)
      .applyQuaternion(camera.quaternion);
    // Camera is the listener, including cinematic and aerial views.
    const ear = {
      x: camera.position.x,
      y: camera.position.y,
      s: -camera.position.z,
      vx: 0,
      vs: 0,
      vy: 0,
    };
    const elapsed = now - (this.lastEar?.time ?? now);
    if (elapsed > 0 && elapsed < 0.2 && playing && this.wasPlaying) {
      ear.vx = (ear.x - this.lastEar.x) / elapsed;
      ear.vs = (ear.s - this.lastEar.s) / elapsed;
      ear.vy = (ear.y - this.lastEar.y) / elapsed;
    }
    this.lastEar = { ...ear, time: now };
    this.wasPlaying = playing;
    const carrierX = CARRIER.startX + CARRIER.speed * run.time;
    const carrierDistance = Math.hypot(
      carrierX - ear.x,
      CARRIER.s - ear.s,
      CARRIER.altitude - ear.y,
    );
    this.carrierEmitter.position(carrierX, CARRIER.altitude, -CARRIER.s, 0);
    this.carrierEmitter.gain.gain.setTargetAtTime(
      cycleMode ? 0 : 0.65 * Math.max(0, 1 - carrierDistance / 14000),
      now,
      0.4,
    );
    this.carrierFilter.frequency.setTargetAtTime(
      Math.max(180, 900 - carrierDistance * 0.12),
      now,
      0.4,
    );
    this.carrierSample?.playbackRate.setTargetAtTime(
      doppler(
        { x: carrierX, s: CARRIER.s, y: CARRIER.altitude, vx: CARRIER.speed, vs: 0, vy: 0 },
        ear,
      ),
      now,
      0.3,
    );
    this.tankEmitter.position(run.x, 1.5, -run.s, run.yaw);
    if (l.positionX) {
      l.positionX.value = ear.x;
      l.positionY.value = ear.y;
      l.positionZ.value = -ear.s;
      l.forwardX.value = forward.x;
      l.forwardY.value = forward.y;
      l.forwardZ.value = forward.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(ear.x, ear.y, -ear.s);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
    this.cycleVoices.update(run.cycleRace,playing,ear,this.cycleOpeningSeconds!==null&&this.cycleOpeningSeconds!==undefined);
    this.recognizerVoices.update(cycleMode ? {recognizers:run.recognizers.filter(e=>e.role==='arena-patrol')} : run, ear);
    if (run.impact > 0.2 && (!this.lastImpact || run.time - this.lastImpact > 0.25)) {
      this.effect('impact');
      this.lastImpact = run.time;
    }
  }
  terminalTone(type) {
    // Access feedback may be scheduled during the trusted gesture's resume.
    if (!this.context || this.context.state === 'closed' || this.muted ||
        (type !== 'access' && this.context.state !== 'running')) return;
    const c = this.context,
      now = c.currentTime,
      access = type === 'access',
      duration = access ? 0.18 : 0.035;
    if (!access) this.terminalClicks = (this.terminalClicks || 0) + 1;
    if (!access && Object.keys(this.keySamples).length) {
      const keys = Object.keys(this.keySamples),
        index =
          (this.lastKeyIndex + 1 + Math.floor(Math.random() * Math.max(1, keys.length - 1))) %
          keys.length;
      this.lastKeyIndex = Number.isFinite(index) ? index : 0;
      const gain = c.createGain();
      gain.gain.value = this.volume * 0.16;
      gain.connect(c.destination);
      const click = this.source(this.keySamples[keys[this.lastKeyIndex]], gain);
      click.onended = () => {
        click.disconnect();
        gain.disconnect();
        this.sources.delete(click);
      };
      return;
    }
    const tone = c.createOscillator(),
      gain = c.createGain();
    // Separate quiet UI route: game ambience stays muted behind the terminal.
    tone.type = access ? 'sine' : 'triangle';
    tone.frequency.setValueAtTime(access ? 980 : 650 + Math.random() * 450, now);
    if (access) tone.frequency.setValueAtTime(1470, now + 0.085);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.volume * (access ? 0.16 : 0.16), now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    tone.connect(gain);
    gain.connect(c.destination);
    tone.start();
    tone.stop(now + duration + 0.01);
    tone.onended = () => {
      tone.disconnect();
      gain.disconnect();
    };
  }
  effect(type, event) {
    if(type==='cycleArrival'||type==='cycleRetry'){this.musicDirector.stopGameplay();return;}
    if (!this.context) return;
    if (type === 'teleport') {
      // Clu hears one continuous transition at the new listener position; other
      // vehicles emit separate departure and arrival cues at their actual sites.
      if (event.player && event.phase === 'departure') return;
      const phase = event.player ? 'player' : event.phase,
        c = this.context;
      this.teleportBuffers ??= {};
      if (!this.teleportBuffers[phase]) {
        const channels = teleportSamples(c.sampleRate, phase),
          buffer = c.createBuffer(2, channels[0].length, c.sampleRate);
        channels.forEach((a, i) => buffer.copyToChannel(a, i));
        this.teleportBuffers[phase] = buffer;
      }
      const emitter = stereoEmitter(c, this.master, TELEPORT_SOUND.refDistance);
      emitter.gain.gain.value = TELEPORT_SOUND.gain;
      emitter.position(event.x, event.y, -event.s, 0);
      const source = this.source(this.teleportBuffers[phase], emitter.input);
      source.onended = () => {
        source.disconnect();
        emitter.input.disconnect();
        emitter.panners.forEach((p) => p.disconnect());
        emitter.gain.disconnect();
        this.sources.delete(source);
      };
      return;
    }
    if (type === 'dataCollected') {
      this.terminalTone('access');
      return;
    }
    if (type === 'dataTransfer' || type === 'dataRingOpen') {
      this.musicDirector.requestMusic(type === 'dataTransfer' ? 'enter' : 'afterglow', event.id);
      const buffer = this.samples[type === 'dataTransfer' ? 'data-ring-close' : 'data-ring-open'];
      if (buffer) {
        const emitter = stereoEmitter(this.context, this.master, 35);
        emitter.gain.gain.value = 0.65;
        emitter.position(event.x, 3, -event.s, 0);
        const source = this.source(buffer, emitter.input);
        source.onended = () => {
          source.disconnect();
          emitter.input.disconnect();
          emitter.panners.forEach((p) => p.disconnect());
          emitter.gain.disconnect();
          this.sources.delete(source);
        };
      }
      return;
    }
    if (type === 'recognized') {
      this.musicDirector.recognitionMusic();
      return;
    }
    const c = this.context,
      now = c.currentTime,
      gain = c.createGain();
    if (type === 'hit' && ['recognizer', 'tank', 'enemyTank'].includes(event?.subject)) {
      if (event.fatal) {
        gain.disconnect();
        return;
      }
      const kind = event.subject === 'recognizer' ? 'recognizer' : 'tank',
        variant = Math.floor(Math.random() * 3),
        key = kind + variant;
      this.armorHitBuffers ??= {};
      if (!this.armorHitBuffers[key]) {
        const channels = recognizerHitSamples(c.sampleRate, kind, variant),
          buffer = c.createBuffer(2, channels[0].length, c.sampleRate);
        channels.forEach((a, i) => buffer.copyToChannel(a, i));
        this.armorHitBuffers[key] = buffer;
      }
      const emitter = stereoEmitter(c, this.master, kind === 'recognizer' ? 45 : 30);
      emitter.gain.gain.value = 1;
      emitter.position(event.x, event.y ?? 2, -event.s, 0);
      gain.gain.value = RECOGNIZER_HIT.gain;
      gain.connect(emitter.input);
      const s = this.source(this.armorHitBuffers[key], gain);
      s.playbackRate.value =
        RECOGNIZER_HIT.minRate + Math.random() * (RECOGNIZER_HIT.maxRate - RECOGNIZER_HIT.minRate);
      s.onended = () => {
        s.disconnect();
        gain.disconnect();
        emitter.input.disconnect();
        emitter.panners.forEach((p) => p.disconnect());
        emitter.gain.disconnect();
        this.sources.delete(s);
      };
      return;
    }
    if (type === 'destroyed' && ['tank', 'enemyTank'].includes(event?.subject)) {
      this.tankExplosionBuffers ??= [];
      const variant =
        this.lastTankExplosionVariant == null
          ? Math.floor(Math.random() * TANK_EXPLOSION.variants)
          : (this.lastTankExplosionVariant +
              1 +
              Math.floor(Math.random() * (TANK_EXPLOSION.variants - 1))) %
            TANK_EXPLOSION.variants;
      this.lastTankExplosionVariant = variant;
      if (!this.tankExplosionBuffers[variant]) {
        const channels = tankExplosionSamples(c.sampleRate, variant),
          buffer = c.createBuffer(2, channels[0].length, c.sampleRate);
        channels.forEach((a, i) => buffer.copyToChannel(a, i));
        this.tankExplosionBuffers[variant] = buffer;
      }
      const emitter = stereoEmitter(c, this.master, TANK_EXPLOSION.refDistance);
      emitter.gain.gain.value = 1;
      emitter.position(event.x, event.y ?? 0, -event.s, event.yaw || 0);
      gain.gain.value = TANK_EXPLOSION.gain;
      gain.connect(emitter.input);
      const source = this.source(this.tankExplosionBuffers[variant], gain);
      source.playbackRate.value =
        TANK_EXPLOSION.minRate + Math.random() * (TANK_EXPLOSION.maxRate - TANK_EXPLOSION.minRate);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        emitter.input.disconnect();
        emitter.panners.forEach((p) => p.disconnect());
        emitter.gain.disconnect();
        this.sources.delete(source);
      };
      return;
    }
    if (
      type === 'destroyed' &&
      event &&
      !['tank', 'enemyTank'].includes(event.subject) &&
      this.samples['recognizer-explosion']
    ) {
      const emitter = stereoEmitter(c, this.master, 35);
      emitter.gain.gain.value = 1;
      emitter.position(event.x, event.y, -event.s, event.yaw || 0);
      gain.gain.value = 0.9;
      gain.connect(emitter.input);
      const s = this.source(this.samples['recognizer-explosion'], gain);
      s.onended = () => {
        s.disconnect();
        gain.disconnect();
        emitter.input.disconnect();
        emitter.panners.forEach((p) => p.disconnect());
        emitter.gain.disconnect();
        this.sources.delete(s);
      };
      return;
    }
    if (type === 'enemyShot') {
      const p = c.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 20;
      p.maxDistance = 12000;
      p.rolloffFactor = 1.2;
      p.positionX.value = event.x;
      p.positionY.value = event.y;
      p.positionZ.value = -event.s;
      gain.connect(p);
      p.connect(this.master);
      gain.gain.value = 0.65;
      if (this.samples.cannon) {
        const s = this.source(this.samples.cannon, gain);
        s.onended = () => {
          s.disconnect();
          gain.disconnect();
          p.disconnect();
          this.sources.delete(s);
        };
      } else {
        gain.disconnect();
        p.disconnect();
      }
      return;
    }
    // Surface strikes are point sounds, positioned at the actual bullet impact.
    let impactPanner;
    if(type==='hit'&&event?.subject==='surface'){
      impactPanner=c.createPanner();
      impactPanner.panningModel='HRTF';
      impactPanner.distanceModel='inverse';
      impactPanner.refDistance=SURFACE_HIT_SOUND.referenceDistanceMeters;
      impactPanner.maxDistance=SURFACE_HIT_SOUND.maximumDistanceMeters;
      impactPanner.rolloffFactor=SURFACE_HIT_SOUND.rolloff;
      impactPanner.positionX.value=event.x;
      impactPanner.positionY.value=event.y??0;
      impactPanner.positionZ.value=-event.s;
      gain.connect(impactPanner);impactPanner.connect(this.master);
    }else gain.connect(this.master);
    if (type === 'shot' && (this.samples['clu-cannon'] || this.samples.cannon)) {
      gain.gain.value = 0.65;
      const s = this.source(this.samples['clu-cannon'] || this.samples.cannon, gain);
      s.playbackRate.value = 1;
      s.onended = () => {
        s.disconnect();
        gain.disconnect();
        this.sources.delete(s);
      };
      return;
    }
    if (type === 'destroyed' || type === 'impact') {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = type === 'destroyed' ? 1300 : 300;
      f.connect(gain);
      gain.gain.setValueAtTime(type === 'destroyed' ? 0.7 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      const s = this.source(this.noiseBuffer, f);
      s.stop(now + 0.85);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        gain.disconnect();
        this.sources.delete(s);
      };
      return;
    }
    const o = c.createOscillator();
    o.type = type === 'shot' ? 'sawtooth' : 'sine';
    const freq = type === 'shot' ? 320 : 820;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 0.2, now + 0.3);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.connect(gain);
    o.start();
    o.stop(now + 0.4);
    o.onended = () => {
      o.disconnect();
      gain.disconnect();
      impactPanner?.disconnect();
    };
  }
  prepareMusic(){this.musicDirector.prepareGameplay();}
  startMusic(...args) {
    this.musicDirector.startMusic(...args);
  }
  resumeMusic() {
    this.musicDirector.resumeMusic();
  }
  fadeMusic(progress) {
    this.musicDirector.fadeMusic(progress);
  }
  reset() {
    this.cycleOpeningAudio?.reset();
    this.musicDirector.reset();
    this.cycleVoices?.reset();
    this.turretServo?.reset();
    this.lastImpact = 0;
    this.lastEar = null;
    this.wasPlaying = false;
    for (const s of this.sources) if (!s.loop) s.stop();
  }
  silence() {
    this.musicDirector.silence();
    this.cycleVoices?.stopPlayback();
    if (this.context) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.turretServo?.dispose();
    this.recognizerVoices?.dispose();
    this.cycleOpeningAudio?.reset();
    this.cycleVoices?.dispose();
    this.musicDirector.dispose();
    this.context?.close();
    this.sources.clear();
  }
}
