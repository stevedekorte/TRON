import { SOLAR_SAILER, SOLAR_SAILER_DEFAULTS } from '../game/solar-sailer.js';
import { loadSolarSailer } from '../rendering/solar-sailer.js';
import { createDevelopmentTools } from './development-tools.js';
import { HudPresenter } from '../ui/hud-presenter.js';
import { GameLoop } from './game-loop.js';
import { InputController } from './input-controller.js';
import { GameSession } from '../simulation/game-session.js';
import { DebrisPhysics } from '../simulation/debris-physics.js';
import { browserScenario } from '../game/browser-scenario.js';
import { HEARING, HEARING_DEFAULTS } from '../game/hearing.js';
import { mergeAutoplayInput } from '../simulation/autoplay-input.js';
import { Autoplay } from '../simulation/autoplay.js';
import { JevClient } from '../ai/jev-client.js';
import { SystemWarnings } from '../ui/system-warnings.js';
import { AI_MODES } from '../game/tactical.js';
import victoryText from '../../docs/victory.txt?raw';
import creditsText from '../../docs/credits.txt?raw';
import { debrisPhysicsReady } from '../simulation/debris-physics.js';
import { loadCloud } from '../rendering/cloud-layer.js';
import { saveScreenshot } from '../ui/screenshot.js';
import { loadCarrier } from '../rendering/carrier.js';
import { loadVehicles } from '../rendering/models.js';
import { Terminal, TerminalTribute, TerminalPrinter } from '../ui/terminal.js';
import { View } from '../rendering/view.js';
import { Sound } from '../audio/sound.js';
import { FLIGHT, FLIGHT_DEFAULTS } from '../simulation/flight.js';
import { startPursuit, boostTank } from '../simulation/run.js';
import { config, defaults, GUNNER } from '../game/config.js';

export function createGameApp() {
  const scenario = browserScenario(location);
  const { world: map } = scenario;
  const $ = (id) => document.getElementById(id);
  const inputController = new InputController();
  const loop = new GameLoop({ frame, backgroundAllowed: () => autoplay.enabled });
  const sound = new Sound(map);
  const jev = new JevClient();
  const autoplay = new Autoplay();
  const systemWarnings = new SystemWarnings($('system-warnings'));
  // Browser defaults supersede the earlier experimental preference once.
  const AI_PREFERENCE_VERSION = 3;
  config.aiMode = 'jev';
  config.aiSmallEncounter = false;
  try {
    const saved = JSON.parse(localStorage.getItem('tron-enemy-ai') || 'null');
    if (
      saved &&
      [2, AI_PREFERENCE_VERSION].includes(saved.version) &&
      AI_MODES.includes(saved.mode)
    ) {
      config.aiMode = saved.mode;
      config.aiSmallEncounter = saved.version === AI_PREFERENCE_VERSION && saved.small === true;
    }
  } catch {}

  const session = new GameSession({ world: map });
  const terminal = new Terminal($('terminal-text'), $('terminal-actions'));
  const tribute = new TerminalTribute($('end-tribute'), creditsText);
  const victoryPrinter=new TerminalPrinter($('terminal-text'),victoryText);
  let endingStage=null;
  let view,
    run = session.run,
    mode = 'loading';
  let showSurvey = false,
    idleTime = 0;
  let windowFocused = true;
  let controlsFirstKey = null,
    idleReminderArmed = false;
  function noteControlKey() {
    if (controlsFirstKey === null) controlsFirstKey = run.time;
    else if (run.time - controlsFirstKey >= 10) idleReminderArmed = true;
  }
  let openingTime = 0,
    pausedFrom = 'running';
  const openingDuration = 5.5;
  const DEATH_TERMINAL = {
    holdSeconds: 1.1,
    fadeSeconds: 1,
    message: 'ILLEGAL CODE\nCLU PROGRAM DETACHED FROM SYSTEM',
  };
  const openingMessage = $('terminal-text').textContent;
  let deathElapsed = 0,
    outroFade = 0;
  let disposed = false;
  let mouseWasLocked = false;
  const GUNNER_WHEEL = { threshold: 40, intervalMs: 180, resetMs: 250 };
  let zoomWheelDelta = 0,
    zoomWheelTime = -Infinity,
    zoomWheelStep = -Infinity;
  const keys = inputController.keys,
    frameTimes = [];
  const listen = inputController.listen.bind(inputController);

  function clearMouseAim() {
    inputController.mouseTarget = null;
    if (view) {
      view.cameraRig.mouseLook = null;
      view.mouseTarget = null;
    }
    run.mouseAim = null;
    run.gunnerYawMotion = run.gunnerPitchMotion = 0;
    run.turretHeading = run.yaw + run.turretYaw;
  }
  function releaseMouse() {
    if (document.pointerLockElement === $('game')) document.exitPointerLock();
  }
  function captureMouse() {
    try {
      $('game')
        .requestPointerLock()
        ?.catch(() => {});
    } catch {}
  }
  function setMode(next) {
    if (!['loading', 'ready', 'entering', 'running', 'paused', 'error'].includes(next))
      throw new Error(`Unknown application mode: ${next}`);
    if (next === 'paused' || next === 'error') inputController.startingThrottle = false;
    mode = next;
    if (next !== 'running') {
      clearMouseAim();
      releaseMouse();
    }
    idleTime = 0;
    loop.resetAccumulator();
    keys.clear();
    inputController.mouseFire = false;
    inputController.fireQueued = false;
    if (next !== 'running') sound.silence();
    $('overlay').hidden = next === 'running';
    $('intro').hidden = !['ready', 'entering'].includes(next);
    $('paused').hidden = next !== 'paused';
    $('error').hidden = next !== 'error';
    $('hud').hidden = !['running', 'entering', 'paused'].includes(next);
    $('pause').hidden = next !== 'running';
    $('footer').hidden = next !== 'ready';
    document.body.classList.toggle('playing', next === 'running');
    document.body.classList.toggle('terminal', ['ready', 'entering'].includes(next));
    document.body.classList.toggle('entering', next === 'entering');
    document.body.classList.toggle('paused', next === 'paused');
    if (next === 'running') document.body.classList.remove('detached');
    if (next === 'paused') $('paused').focus({ preventScroll: true });
  }

  async function start() {
    if (mode === 'entering') return;
    const fromTerminal = mode === 'ready',
      opening = fromTerminal && !view.cameraRig.reducedMotion;
    // Request both context and media playback before yielding the Return gesture.
    let audioReady;
    try {
      audioReady = sound
        .unlock()
        .catch((e) => console.warn('Audio unavailable; continuing silently.', e.message));
    } catch (e) {
      console.warn('Audio unavailable; continuing silently.', e.message);
    }
    if (disposed || mode === 'error') return;
    tribute.reset();
    victoryPrinter.reset();endingStage=null;document.body.classList.remove('victory','victory-credits');
    $('terminal-text').textContent=openingMessage;
    $('terminal-text').parentElement.setAttribute('aria-label',openingMessage.replace('\n','. '));
    outroFade = 0;
    controlsFirstKey = null;
    idleReminderArmed = false;
    deathElapsed = 0;
    $('death-fade').hidden = true;
    jev.resetScheduling();
    autoplay.reset();
    run = session.reset();
    run.speed = config.maxSpeed;
    startPursuit(run);
    inputController.startingThrottle = true;
    session.previous = { ...run };
    view.reset();
    sound.reset();
    view.cameraRig.aerial = false;
    view.cameraRig.aerialZoom = 1;
    openingTime = 0;
    view.cameraRig.opening = opening ? 0 : null;
    document.body.style.setProperty('--opening-fade', '1');
    setMode(opening ? 'entering' : 'running');
    sound.startMusic();
    await audioReady;
    if (fromTerminal && !disposed && ['entering', 'running'].includes(mode))
      sound.terminalTone('access');
  }
  function pause() {
    if (mode === 'running' || mode === 'entering') {
      pausedFrom = mode;
      setMode('paused');
    }
  }
  async function resume() {
    if (mode !== 'paused') return;
    setMode(pausedFrom);
    const audioReady = sound.unlock().catch(() => {});
    sound.resumeMusic();
    await audioReady;
    if (!['running', 'entering'].includes(mode)) sound.silence();
  }
  function mute() {
    sound.muted = !sound.muted;
    $('sound').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
    $('sound').setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  }
  function fail(message) {
    $('error-message').textContent = message;
    setMode('error');
  }

  listen($('start'), 'click', start);
  listen($('pause'), 'click', pause);
  listen($('sound'), 'click', mute);
  listen(window, 'keydown', (event) => {
    idleTime = 0;
    if (mode === 'loading') return;
    if(event.code==='KeyN'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['running','entering','paused'].includes(mode)){
      event.preventDefault();
      if(!event.repeat)setJevEnabled(config.aiMode!=='jev');
      return;
    }
    // Temporary victory-preview shortcut; remove after end-screen review.
    if(event.code==='Digit8'&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&view&&mode!=='error'){
      event.preventDefault();
      if(!event.repeat&&endingStage!=='victory'){
        run.won=true;run.crushed=false;run.speed=0;
        showVictoryScreen();
      }
      return;
    }
    if (
      event.code === 'KeyU' &&
      !event.repeat &&
      ['running', 'entering', 'paused'].includes(mode)
    ) {
      event.preventDefault();
      setAutoplay(!autoplay.enabled);
      return;
    }
    if (
      ['F9', 'KeyB'].includes(event.code) &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      view &&
      ['running', 'entering', 'paused'].includes(mode)
    ) {
      event.preventDefault();
      if (!event.repeat) saveScreenshot(view, $('game'));
      return;
    }
    if (['running', 'entering'].includes(mode) && !event.repeat) noteControlKey();
    if (mode === 'ready') sound.unlock().catch(() => {});
    if (mode === 'paused') {
      event.preventDefault();
      if (!event.repeat) {
        resume();
        if (event.code === 'KeyW') run.cruiseThrottle = event.shiftKey;
        if (
          ['running', 'entering'].includes(mode) &&
          [
            'KeyW',
            'KeyA',
            'KeyS',
            'KeyD',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'KeyI',
            'KeyJ',
            'KeyK',
            'KeyL',
          ].includes(event.code)
        )
          keys.add(event.code);
      }
      return;
    }
    if (event.target instanceof HTMLInputElement) return;
    const key = event.code;
    if (
      !event.repeat &&
      ['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(key) &&
      ['running', 'entering'].includes(mode)
    )
      clearMouseAim();
    if (key === 'KeyW' && !event.repeat && ['running', 'entering'].includes(mode)) {
      run.cruiseThrottle = event.shiftKey ? true : false;
      if (!event.shiftKey) inputController.startingThrottle = false;
    }
    if (!event.repeat && ['running', 'entering'].includes(mode) && key === 'KeyP') {
      view.cameraRig.beamCamera.cancel();
      if (mode === 'entering') finishOpening();
      run.gunner = !run.gunner;
      clearMouseAim();
      if (!run.gunner) releaseMouse();
      view.cameraRig.aerial = false;
      view.cameraRig.freshCamera = view.cameraRig.reducedMotion;
      return;
    }
    if (!event.repeat && ['running', 'entering'].includes(mode) && key === 'KeyO' && run.gunner) {
      run.gunnerZoom =
        run.gunnerZoom + 1 < GUNNER.fovs.length ? run.gunnerZoom + 1 : GUNNER.minZoom;
      return;
    }
    if (
      ['running', 'entering'].includes(mode) &&
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)
    )
      event.preventDefault();
    if (key === 'Tab' && mode === 'running') {
      event.preventDefault();
      if (!event.repeat) showSurvey = !showSurvey;
      return;
    }
    if (event.repeat) return;
    if (key === 'KeyF' && ['running', 'entering'].includes(mode)) {
      clearMouseAim();
      run.gunnerLeveling = true;
      run.turretCentering = true;
      run.turretLocked = true;
      return;
    }
    if (key === 'KeyV' && mode === 'running') {
      view.cameraRig.beamCamera.cancel();
      run.gunner = false;
      clearMouseAim();
      releaseMouse();
      view.cameraRig.aerial = !view.cameraRig.aerial;
      view.cameraRig.freshCamera = view.cameraRig.reducedMotion;
      return;
    }
    if (key === 'Enter' && mode === 'ready') {
      event.preventDefault();
      if(event.repeat)return;
      if(endingStage==='victory'){startVictoryCredits();return;}
      terminal.done ? start() : terminal.finish();
      return;
    }
    if (mode === 'entering' && key === 'Enter') {
      event.preventDefault();
      finishOpening();
      return;
    }
    if (key === 'Escape') {
      ['running', 'entering'].includes(mode) ? pause() : resume();
      return;
    }
    if (key === 'KeyM') {
      mute();
      return;
    }
    if (key === 'KeyT') {
      if (event.shiftKey && import.meta.env.DEV) {
        $('tuning').hidden = !$('tuning').hidden;
        return;
      }
      if (['running', 'entering'].includes(mode)) boostTank(run);
      return;
    }
    if (['running', 'entering'].includes(mode)) {
      if (key === 'Space') inputController.fireQueued = true;
      if (['KeyS', 'ArrowDown'].includes(key)) inputController.startingThrottle = false;
      keys.add(key);
    }
  });
  function setJevEnabled(enabled) {
    config.aiMode=enabled?'jev':'local';
    session.configure('vehicle',{aiMode:config.aiMode});
    jev.resetScheduling();
    if(!enabled&&autoplay.enabled)setAutoplay(false);
    if(import.meta.env.DEV)$('enemy-ai').value=config.aiMode;
    try{localStorage.setItem('tron-enemy-ai',JSON.stringify({version:AI_PREFERENCE_VERSION,mode:config.aiMode,small:config.aiSmallEncounter}));}catch{}
  }
  function setAutoplay(enabled) {
    if(enabled&&config.aiMode!=='jev')setJevEnabled(true);
    autoplay.setEnabled(enabled);
    jev.resetScheduling();
    inputController.startingThrottle = false;
    run.cruiseThrottle = false;
    keys.clear();
    inputController.mouseFire = false;
    inputController.fireQueued = false;
    clearMouseAim();
    if (enabled) {
      run.gunner = false;
      run.turretLocked = false;
      run.turretCentering = false;
      releaseMouse();
    }
  }
  listen($('autoplay-toggle'), 'click', () => setAutoplay(!autoplay.enabled));
  listen(window, 'keyup', (e) => {
    idleTime = 0;
    keys.delete(e.code);
    if (e.code === 'KeyW') inputController.startingThrottle = false;
  });
  listen($('game'), 'pointerdown', (e) => {
    idleTime = 0;
    if (run.gunner && !GUNNER.mouseEnabled) return;
    if (['running', 'entering'].includes(mode) && e.button === 0) {
      if (run.gunner && document.pointerLockElement !== $('game')) {
        captureMouse();
        return;
      }
      inputController.mouseFire = true;
      inputController.fireQueued = true;
    }
  });
  listen(document, 'mousemove', (event) => {
    if (
      !GUNNER.mouseEnabled ||
      mode !== 'running' ||
      !run.gunner ||
      run.crushed ||
      document.pointerLockElement !== $('game')
    )
      return;
    if (!event.movementX && !event.movementY) return;
    view.cameraRig.moveMouseAim(event.movementX, event.movementY, run);
    idleTime = 0;
  });
  listen(document, 'pointerlockchange', () => {
    const locked = document.pointerLockElement === $('game');
    if (mouseWasLocked && !locked) {
      clearMouseAim();
      inputController.mouseFire = false;
      inputController.fireQueued = false;
      if (!autoplay.enabled && run.gunner && !run.crushed && mode === 'running') pause();
    }
    mouseWasLocked = locked;
  });
  listen(
    $('game'),
    'wheel',
    (event) => {
      if (run.gunner && !GUNNER.mouseEnabled) {
        event.preventDefault();
        return;
      }
      if (!(view?.cameraRig.aerial || run.gunner) || !['running', 'paused'].includes(mode) || event.ctrlKey)
        return;
      event.preventDefault();
      idleTime = 0;
      const pixels =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (run.gunner) {
        const now = performance.now();
        if (
          now - zoomWheelTime > GUNNER_WHEEL.resetMs ||
          Math.sign(pixels) !== Math.sign(zoomWheelDelta)
        )
          zoomWheelDelta = 0;
        zoomWheelTime = now;
        zoomWheelDelta += pixels;
        if (
          Math.abs(zoomWheelDelta) >= GUNNER_WHEEL.threshold &&
          now - zoomWheelStep >= GUNNER_WHEEL.intervalMs
        ) {
          run.gunnerZoom = Math.max(
            GUNNER.minZoom,
            Math.min(GUNNER.fovs.length - 1, run.gunnerZoom - Math.sign(zoomWheelDelta)),
          );
          zoomWheelDelta = 0;
          zoomWheelStep = now;
        }
        return;
      }
      view.cameraRig.aerialZoom = Math.max(
        0.25,
        Math.min(
          4,
          view.cameraRig.aerialZoom * Math.exp(Math.max(-600, Math.min(600, pixels)) * 0.0015),
        ),
      );
    },
    { passive: false },
  );
  listen(window, 'pointerup', () => {
    inputController.mouseFire = false;
  });
  listen(window, 'blur', () => {
    windowFocused = false;
    keys.clear();
    inputController.mouseFire = false;
    inputController.fireQueued = false;
    clearMouseAim();
    if (!autoplay.enabled) pause();
  });
  listen(window, 'focus', () => {
    windowFocused = true;
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      inputController.mouseFire = false;
      inputController.fireQueued = false;
      clearMouseAim();
      if (!autoplay.enabled) pause();
    }
    if (view && !disposed) {
      loop.reschedule();
    }
  });
  listen(window, 'resize', () => view?.resize());
  listen($('game'), 'webglcontextlost', (event) => {
    event.preventDefault();
    fail('The graphics connection was interrupted. Reload to reconnect.');
  });

  const hud = new HudPresenter(map, systemWarnings);

  function showVictoryScreen(){
    endingStage='victory';tribute.reset();outroFade=0;
    view.cameraRig.opening=null;
    document.body.style.setProperty('--opening-fade','1');
    document.body.classList.remove('detached','victory-credits');
    document.body.classList.add('victory');
    setMode('ready');sound.reset();jev.resetScheduling();
    $('terminal-text').parentElement.setAttribute('aria-label',victoryText.trimEnd());
    victoryPrinter.start();$('death-fade').hidden=true;
  }

  function startVictoryCredits(){
    endingStage='credits';victoryPrinter.reset();
    document.body.classList.remove('victory');document.body.classList.add('detached','victory-credits');
    $('terminal-text').textContent='';$('terminal-text').parentElement.setAttribute('aria-label','');
    sound.startMusic('terminal');tribute.start(view.cameraRig.reducedMotion);
  }

  function updateDeathTerminal(dt) {
    const fade = $('death-fade');
    if(mode==='ready'&&endingStage==='victory'){victoryPrinter.update();return;}
    if (mode === 'ready' && (run.crushed||endingStage==='credits')) {
      const music = sound.musicDirector.music;
      const signOffReady =
        sound.musicDirector.musicMode === 'terminal' &&
        (music?.ended ||
          (Number.isFinite(music?.duration) && music.currentTime >= music.duration - 5) ||
          !!sound.musicDirector.musicError);
      if (tribute.update(dt, signOffReady)) sound.endOfLine();
      if (!tribute.active && tribute.phase === 'signoff') {
        outroFade += dt;
        fade.hidden = false;
        fade.style.opacity = String(Math.min(1, outroFade / 5));
        if (outroFade >= 5) {
          sound.reset();
          tribute.reset();
          run = session.reset();
          view.reset();
          view.cameraRig.opening = null;
          document.body.classList.remove('detached','victory','victory-credits');endingStage=null;
          $('terminal-text').textContent = openingMessage;
          $('terminal-text').parentElement.setAttribute(
            'aria-label',
            openingMessage.replace('\n', '. '),
          );
          deathElapsed = 0;
          outroFade = 0;
          setMode('ready');
          fade.hidden = true;
          $('terminal-text').parentElement.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 500,
          });
        }
      }
      return;
    }
    if (!run.crushed&&!run.won) {
      deathElapsed = 0;
      fade.hidden = true;
      return;
    }
    if (!['running', 'entering'].includes(mode)) return;
    deathElapsed += dt;
    sound.fadeMusic(deathElapsed / (DEATH_TERMINAL.holdSeconds + DEATH_TERMINAL.fadeSeconds));
    const amount = Math.max(
      0,
      Math.min(1, (deathElapsed - DEATH_TERMINAL.holdSeconds) / DEATH_TERMINAL.fadeSeconds),
    );
    fade.hidden = amount === 0;
    fade.style.opacity = String(amount);
    if (amount < 1) return;
    view.cameraRig.opening = null;
    document.body.style.setProperty('--opening-fade', '1');
    if(run.won){
      showVictoryScreen();return;
    }
    $('terminal-text').textContent = DEATH_TERMINAL.message;
    const copy = $('terminal-text').parentElement;
    copy.setAttribute('aria-label', DEATH_TERMINAL.message.replace('\n', '. '));
    document.body.classList.add('detached');
    setMode('ready');
    sound.startMusic('terminal');
    tribute.start(view.cameraRig.reducedMotion);
    fade.hidden = true;
    copy.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: view.cameraRig.reducedMotion ? 0 : 500,
    });
  }

  function finishOpening() {
    const held = [...keys],
      firing = inputController.mouseFire,
      queued = inputController.fireQueued;
    view.cameraRig.opening = null;
    openingTime = openingDuration;
    setMode('running');
    for (const key of held) keys.add(key);
    inputController.mouseFire = firing;
    inputController.fireQueued = queued;
  }

  function frame(dt, background) {
    if (disposed) return;
    if (run.crushed && run.mouseAim) clearMouseAim();
    if (!autoplay.enabled && (document.hidden || !windowFocused)) pause();
    if (mode === 'running') idleTime = keys.size || inputController.mouseFire ? 0 : idleTime + dt;
    if (mode === 'entering') {
      openingTime += dt;
      view.cameraRig.opening = Math.min(1, openingTime / openingDuration);
      document.body.style.setProperty('--opening-fade', String(Math.max(0, 1 - openingTime / 1.1)));
      if (openingTime >= openingDuration || view.cameraRig.reducedMotion) finishOpening();
    }
    if (mode === 'running' || mode === 'entering') {
      if (frameTimes.length >= 3600) frameTimes.shift();
      if (dt > 0) frameTimes.push(dt * 1000);
      loop.advance(
        dt,
        background,
        () => !run.won && (mode === 'running' || mode === 'entering'),
        (fixedStep) => {
          let command = inputController.command(run, {
            mouseLook: view.cameraRig.mouseLook,
            mouseTarget: view.mouseTarget,
          });
          if (autoplay.enabled)
            command = mergeAutoplayInput(autoplay.input(run), command, keys, run);
          const events = session.advance(command, fixedStep);
          inputController.consume();
          for (const event of events) {
            view.event(event);
            sound.effect(event.type, event);
          }
        },
      );
    }
    jev.update(run, !run.won && (mode === 'running' || mode === 'entering'), autoplay);
    if (!autoplay.enabled && (document.hidden || !windowFocused)) pause();
    if (view && mode !== 'error') updateDeathTerminal(dt);
    if (view && mode !== 'error') {
      if (!document.hidden && !(mode==='ready'&&endingStage==='victory'))
        view.render(run, session.previous, mode === 'running' ? loop.alpha : 1, dt, mode);
      sound.update(run, view.camera, mode === 'running' || mode === 'entering');
      hud.update({
        run,
        view,
        mode,
        autoplay,
        jev,
        showSurvey,
        controlsFirstKey,
        idleReminderArmed,
        idleTime,
      });
    }
  }

  async function initialize() {
    try {
      await debrisPhysicsReady;
      const context = $('game').getContext('webgl2', {
        stencil: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      if (!context)
        throw new Error(
          'This game needs WebGL 2. Try a current desktop browser with hardware acceleration enabled.',
        );
      const [[tank, recognizer], carrier, cloud, solarSailer] = await Promise.all([
        loadVehicles(),
        loadCarrier(),
        loadCloud(),
        loadSolarSailer(),
      ]);
      const physics = new DebrisPhysics(map.nearbyWalls);
      view = new View($('game'), tank, recognizer, carrier, cloud, map, physics, solarSailer);
      session.attachDebris(physics, view.breakups);
      if (disposed) {
        view.dispose();
        physics.dispose();
        return;
      }
      const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
      view.cameraRig.reducedMotion = motionPreference.matches;
      listen(motionPreference, 'change', (e) => {
        view.cameraRig.reducedMotion = e.matches;
      });

      $('start').disabled = false;
      $('start').querySelector('span').textContent = 'ENTER THE MAZE';
      terminal.finish();
      setMode('ready');
      loop.start();
    } catch (error) {
      console.error(error);
      if (!disposed) fail(error.message);
    }
  }

  if (import.meta.env.DEV) {
    $('enemy-ai').value = config.aiMode;
    $('ai-small-encounter').checked = config.aiSmallEncounter;
    listen($('apply-ai'), 'click', () => {
      config.aiMode = $('enemy-ai').value;
      config.aiSmallEncounter = $('ai-small-encounter').checked;
      try {
        localStorage.setItem(
          'tron-enemy-ai',
          JSON.stringify({
            version: AI_PREFERENCE_VERSION,
            mode: config.aiMode,
            small: config.aiSmallEncounter,
          }),
        );
      } catch {}
      session.configure('vehicle', {
        aiMode: config.aiMode,
        aiSmallEncounter: config.aiSmallEncounter,
      });
      jev.resetScheduling();
      start();
    });
    const ranges = {
      aiConfidence: [0, 1, 0.05],
      acceleration: [4, 20, 0.5],
      braking: [8, 35, 1],
      maxSpeed: [15, 40, 1],
      steering: [0.4, 2.5, 0.05],
      cameraDistance: [10, 30, 1],
      cameraHeight: [4, 14, 0.5],
      cameraLag: [2, 15, 0.5],
      fov: [45, 85, 1],
      enemySpeed: [10, 45, 1],
      bloom: [0, 1, 0.05],
      fog: [0.001, 0.009, 0.0002],
      renderScale: [0.5, 1, 0.1],
    };
    const flightRanges = {
      turnRate: [0.1, 3, 0.02, 'rad/s'],
      turnAcceleration: [0.1, 6, 0.05, 'rad/s²'],
      liftAcceleration: [2, 30, 1, 'm/s²'],
      liftSpeed: [5, 35, 1, 'm/s'],
    };
    const hearingRanges = {
      engineMovingRangeMeters: [40, 200, 5],
      cannonRangeMeters: [200, 1200, 25],
      explosionRangeMeters: [300, 1600, 25],
    };
    const tuningFields = [
      ...Object.entries({ altitudeMeters: [400, 1200, 20], speedMetersPerSecond: [100, 440, 5], periodSeconds: [150, 360, 10], scale: [1, 5, 0.25] }).map(([key, range]) => ({ key, range, target: SOLAR_SAILER, title: `Solar Sailer ${key}` })),
      ...Object.entries(hearingRanges).map(([key, range]) => ({
        key,
        range,
        target: HEARING,
        title: `Hearing ${key} (m)`,
      })),
      ...Object.entries(ranges).map(([key, range]) => ({ key, range, target: config, title: key })),
      ...Object.entries(flightRanges).map(([key, range]) => ({
        key,
        range,
        target: FLIGHT,
        title: `Recognizer ${key} (${range[3]})`,
      })),
    ];
    for (const {
      key,
      range: [min, max, stepSize],
      target,
      title,
    } of tuningFields) {
      const label = document.createElement('label');
      label.innerHTML = `<span>${title}</span><output>${target[key]}</output><input type="range" min="${min}" max="${max}" step="${stepSize}" value="${target[key]}">`;
      listen(label.querySelector('input'), 'input', (e) => {
        target[key] = Number(e.target.value);
        if (target !== SOLAR_SAILER) session.configure(
          target === config ? 'vehicle' : target === FLIGHT ? 'flight' : 'hearing',
          { [key]: target[key] },
        );
        label.querySelector('output').value = target[key];
        if (key === 'renderScale') view.resize();
      });
      $('sliders').append(label);
    }
    listen($('reset-tuning'), 'click', () => {
      Object.assign(config, defaults, {
        aiMode: config.aiMode,
        aiSmallEncounter: config.aiSmallEncounter,
      });
      Object.assign(SOLAR_SAILER, SOLAR_SAILER_DEFAULTS);
      Object.assign(FLIGHT, FLIGHT_DEFAULTS);
      Object.assign(HEARING, HEARING_DEFAULTS);
      session.configure('vehicle', config);
      session.configure('flight', FLIGHT);
      session.configure('hearing', HEARING);
      view.resize();
      [...$('sliders').children].forEach((label, i) => {
        const { target, key } = tuningFields[i],
          v = target[key];
        label.querySelector('input').value = v;
        label.querySelector('output').value = v;
      });
    });
    listen($('export-tuning'), 'click', () =>
      navigator.clipboard.writeText(
        JSON.stringify({ ...config, recognizerFlight: FLIGHT, solarSailer: SOLAR_SAILER }, null, 2),
      ),
    );
    // Development-only observability/scenario placement; outcomes still run through step().
    window.__tron = createDevelopmentTools({
      session,
      getView: () => view,
      sound,
      autoplay,
      jev,
      getMode: () => mode,
      start,
      frameTimes,
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    jev.dispose();
    loop.dispose();
    inputController.dispose();
    view?.dispose();
    session.dispose();
    sound.dispose();
  }
  listen(window, 'pagehide', (event) => {
    if (!event.persisted) dispose();
    else pause();
  });

  const ready = initialize();
  return {
    ready,
    dispose,
    start,
    pause,
    resume,
    get session() {
      return session;
    },
  };
}
