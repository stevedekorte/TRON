import {
  musicCategory,
  selectMusic,
  activelyPursued,
  closeRecognizer,
  mazeMusicCue,
  beamBaseVisible,
  MAZE_CUE_RANK,
  MAZE_MUSIC,
  MUSIC_CUES,
} from './music-selection.js';
import afterglowUrl from '../../docs/assets/music/Tron/13 Tower Music - Let Us Pray/5 afterglow.mp3?url';
import enterBeamUrl from '../../docs/assets/music/Tron/13 Tower Music - Let Us Pray/4 enter beam.mp3?url';
import approachingUrl from '../../docs/assets/music/Tron/13 Tower Music - Let Us Pray/2 approacing beam.mp3?url';
import spottedUrl from '../../docs/assets/music/Tron/13 Tower Music - Let Us Pray/3 spotted beam.mp3?url';
import explorationUrl from '../../docs/assets/music/Tron/13 Tower Music - Let Us Pray/1 maze exploration.mp3?url';
import endMusicUrl from '../../docs/assets/music/Tron/02 Only Solutions.mp3?url';
import musicUrl from "../../docs/assets/music/Tron/03 We've Got Company Clips/1 recognized 1.mp3?url";
const musicClips = Object.entries(
  import.meta.glob("../../docs/assets/music/Tron/03 We've Got Company Clips/*.mp3", {
    eager: true,
    query: '?url',
    import: 'default',
  }),
).map(([path, url]) => ({ url, category: musicCategory(path) }));
musicClips.push(
  { url: explorationUrl, category: 'exploration' },
  { url: approachingUrl, category: 'approaching' },
  { url: spottedUrl, category: 'spotted' },
  { url: enterBeamUrl, category: 'enter' },
  { url: afterglowUrl, category: 'afterglow' },
);
const isMazeCue = (category) => category === 'exploration' || category in MAZE_CUE_RANK;
const isTransferCue = (category) => category === 'enter' || category === 'afterglow';
/** Owns music policy, media playback, fades and the music bus. Borrows AudioContext. */
export class MusicDirector {
  constructor(world) {
    this.world = world;
  }
  init(context, output) {
    const c = (this.context = context),
      limiter = output;
    this.music = new Audio(musicUrl);
    this.music.preload = 'auto';
    this.music.loop = false;
    this.musicMaster = c.createGain();
    this.musicMaster.gain.value = 0;
    this.musicMaster.connect(limiter);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.musicMaster);
    this.musicSource = c.createMediaElementSource(this.music);
    this.musicSource.connect(this.musicGain);
    this.music.addEventListener('ended', () => this.nextMusic());
    this.music.addEventListener('error', () => {
      this.musicError = 'Music could not be loaded';
    });
  }
  updateMusic(run, camera, playing) {
    const now = this.context.currentTime;
    const wasPursued = this.pursued;
    this.pursued = activelyPursued(run);
    this.musicPlaying = playing;
    if (playing && !run.crushed) {
      const close = closeRecognizer(run, this.closeEncounter);
      if (close && !this.closeEncounter) this.requestMusic('gotcha');
      this.closeEncounter = close;
      if (
        this.pursued &&
        (isMazeCue(this.musicCategory) || isMazeCue(this.musicTransition?.category)) &&
        (!this.musicTransition ||
          isMazeCue(this.musicTransition.category) ||
          this.musicTransition.category === 'silence')
      )
        this.requestMusic('pursued');
      else if (wasPursued && !this.pursued) this.fadeToQuiet();
      else if (this.pursued && this.musicTransition?.category === 'silence') {
        this.musicTransition = null;
        this.musicGain.gain.cancelAndHoldAtTime(now);
        this.musicGain.gain.linearRampToValueAtTime(0.55, now + MUSIC_CUES.fadeIn);
      } else if (this.pursued && !wasPursued && !this.musicStarted) this.requestMusic('pursued');
      if (
        !this.pursued &&
        !this.musicTransition &&
        !this.music.paused &&
        !this.music.ended &&
        Number.isFinite(this.music.duration) &&
        this.music.duration - this.music.currentTime <= MUSIC_CUES.quietFade
      )
        this.fadeToQuiet();
      const cue = mazeMusicCue(run, (beam) => beamBaseVisible(beam, camera, this.world));
      this.mazeCueHistory ??= new Map();
      if (
        !cue &&
        !this.pursued &&
        !isTransferCue(this.musicTransition?.category) &&
        !isTransferCue(this.musicCategory) &&
        (isMazeCue(this.musicTransition?.category) ||
          (isMazeCue(this.musicCategory) && this.musicStarted))
      )
        this.fadeToQuiet();
      if (cue) {
        const played =
          cue.category === 'exploration'
            ? this.explorationPlayed
            : (this.mazeCueHistory.get(cue.beamId) || 0) >= MAZE_CUE_RANK[cue.category];
        // A stronger location cue can replace a pending weaker cue, but ordinary
        // exploration waits for an existing cue/fade to finish.
        if (
          !played &&
          !(
            cue.category === 'exploration' &&
            isMazeCue(this.musicCategory) &&
            this.musicStarted &&
            !this.music.ended
          ) &&
          (!this.musicTransition ||
            ((MAZE_CUE_RANK[cue.category] || 0) >
              (MAZE_CUE_RANK[this.musicTransition.category] || 0) &&
              isMazeCue(this.musicTransition.category)))
        )
          this.requestMusic(cue.category, cue.beamId);
      }
      if (
        isMazeCue(this.musicTransition?.category) &&
        !isTransferCue(this.musicTransition.category) &&
        (!cue ||
          cue.category !== this.musicTransition.category ||
          cue.beamId !== this.musicTransition.beamId)
      )
        this.fadeToQuiet();
      if (this.music.ended && !this.musicTransition) this.nextMusic();
      if (this.musicTransition && now >= this.musicTransition.at) {
        const { url, beamId } = this.musicTransition;
        this.musicTransition = null;
        if (url) {
          this.startMusic('gameplay', url, beamId);
          this.musicGain.gain.setValueAtTime(0, now);
          this.musicGain.gain.linearRampToValueAtTime(0.55, now + MUSIC_CUES.fadeIn);
        } else {
          this.musicGain.gain.setValueAtTime(0, now);
          this.music.pause();
          this.musicStarted = false;
        }
      }
    }
  }
  fadeMusic(progress) {
    this.musicTransition = null;
    this.pursued = false;
    if (!this.musicGain) return;
    const gain = this.musicGain.gain,
      now = this.context.currentTime;
    this.deathMusicGain ??= gain.value;
    const level = this.deathMusicGain * Math.pow(1 - Math.max(0, Math.min(1, progress)), 2);
    gain.cancelScheduledValues(now);
    if (progress >= 1) gain.setValueAtTime(0, now);
    else gain.setTargetAtTime(level, now, 0.02);
  }
  fadeToQuiet() {
    if (
      !this.music ||
      this.musicMode !== 'gameplay' ||
      this.musicTransition?.category === 'silence'
    )
      return;
    const now = this.context.currentTime,
      gain = this.musicGain.gain;
    const remaining = this.music.duration - this.music.currentTime;
    const duration = Number.isFinite(remaining)
      ? Math.min(MUSIC_CUES.quietFade, Math.max(0, remaining))
      : MUSIC_CUES.quietFade;
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(0, now + duration);
    this.musicTransition = { url: null, category: 'silence', at: now + duration };
  }
  nextMusic() {
    if (
      this.disposed ||
      this.musicMode !== 'gameplay' ||
      !this.musicPlaying ||
      this.musicTransition
    )
      return;
    if (this.pursued) this.requestMusic('pursued');
  }
  recognitionMusic() {
    if (this.closeEncounter || this.musicTransition?.category === 'gotcha') return;
    // One phrase covers overlapping recognitions, rather than restarting constantly.
    if (this.musicCategory === 'recognized' && !this.music.ended && !this.music.paused) return;
    this.requestMusic('recognized');
  }
  requestMusic(category, beamId = null) {
    if (
      !this.music ||
      this.musicMode !== 'gameplay' ||
      this.disposed ||
      this.musicTransition?.category === category
    )
      return;
    const url = selectMusic(musicClips, category, this.currentMusicUrl);
    if (!url) return;
    const now = this.context.currentTime,
      gain = this.musicGain.gain;
    gain.cancelAndHoldAtTime(now);
    const duration =
      this.music.ended || this.music.paused
        ? 0
        : isMazeCue(category)
          ? MAZE_MUSIC.fadeSeconds
          : MUSIC_CUES.fadeOut;
    gain.linearRampToValueAtTime(0, now + duration);
    this.musicTransition = { url, category, beamId, at: now + duration };
  }
  startMusic(mode = 'gameplay', clipUrl = null, beamId = null) {
    if (!this.music) return;
    const url = clipUrl || (mode === 'terminal' ? endMusicUrl : musicUrl);
    if (this.currentMusicUrl !== url) this.music.src = url;
    this.currentMusicUrl = url;
    this.musicCategory = musicClips.find((c) => c.url === url)?.category || null;
    if (this.musicCategory === 'exploration') this.explorationPlayed = true;
    if (MAZE_CUE_RANK[this.musicCategory]) {
      this.mazeCueHistory ??= new Map();
      this.mazeCueHistory.set(beamId, MAZE_CUE_RANK[this.musicCategory]);
    }
    if (mode === 'terminal') this.musicTransition = null;
    this.music.loop = false;
    this.musicMode = mode;
    this.musicError = null;
    this.deathMusicGain = null;
    this.musicGain.gain.cancelScheduledValues(this.context.currentTime);
    this.musicGain.gain.setValueAtTime(0.55, this.context.currentTime);
    this.music.currentTime = 0;
    this.musicStarted = true;
    this.resumeMusic();
  }
  resumeMusic() {
    if (this.musicStarted && !this.music.ended && !this.disposed)
      this.music.play().catch((e) => {
        this.musicError = e.message;
      });
  }

  reset() {
    this.mazeCueHistory = new Map();
    this.explorationPlayed = false;
    this.musicTransition = null;
    this.closeEncounter = false;
    this.pursued = false;
    this.music?.pause();
    if (this.music) this.music.currentTime = 0;
    this.musicStarted = false;
    this.musicMode = null;
  }
  silence() {
    this.music?.pause();
    if (this.context) this.musicMaster.gain.setTargetAtTime(0, this.context.currentTime, 0.02);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.music?.pause();
    this.music?.removeAttribute('src');
    this.music?.load();
    this.musicSource?.disconnect();
    this.musicGain?.disconnect();
    this.musicMaster?.disconnect();
  }
}
