import {CLU_AUTOPLAY_ENABLED} from '../game/autoplay.js';
import {RECOGNIZER_TINTS} from '../game/recognizer-appearance.js';
import {CYCLE_OPENING} from '../rendering/camera-rig.js';
import { LoadingTimings } from './loading-timings.js';
import { CYCLE_TESTING } from '../game/light-cycles.js';
import {CycleTuning} from '../ui/cycle-tuning.js';
import {disposeSceneResources} from '../rendering/scene-resources.js';
import { SOLAR_SAILER, SOLAR_SAILER_DEFAULTS } from '../game/solar-sailer.js';

import { createDevelopmentTools } from './development-tools.js';
import { HudPresenter } from '../ui/hud-presenter.js';
import { GameLoop, simulationStepSeconds } from './game-loop.js';
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
import extendedCreditsText from '../../docs/credits_display.txt?raw';
import { debrisPhysicsReady } from '../simulation/debris-physics.js';
import { loadCloud } from '../rendering/cloud-layer.js';
import { saveScreenshot } from '../ui/screenshot.js';
import { loadCarrier } from '../rendering/carrier.js';
import { loadVehicles } from '../rendering/models.js';
import { Terminal, TerminalTribute, TerminalPrinter, HumanTerminalPrinter } from '../ui/terminal.js';
import { View } from '../rendering/view.js';
import { Sound } from '../audio/sound.js';
import { FLIGHT, FLIGHT_DEFAULTS } from '../simulation/flight.js';
import { startPursuit, boostTank } from '../simulation/run.js';
import { config, defaults, GUNNER, AERIAL_ZOOM, FOLLOW_ZOOM } from '../game/config.js';

export function createGameApp() {
  performance.mark('tron:startup');
  const loadingTimings = new LoadingTimings();
  const scenario = loadingTimings.sync('Scenario / maze geometry',()=>browserScenario(location));
  const { world: map } = scenario;
  const cycleStart = new URLSearchParams(location.search).get('cycleStart');
  const testCycleStart = cycleStart === '1';
  let selectedGame = testCycleStart ? 'cycles' : 'space';
  const $ = (id) => document.getElementById(id);
  const inputController = new InputController();
  const loop = new GameLoop({ frame, backgroundAllowed: () => autoplay.enabled });
  const sound = new Sound(map);
  const jev = new JevClient();
  const autoplay = new Autoplay({available:CLU_AUTOPLAY_ENABLED});
  const systemWarnings = new SystemWarnings($('system-warnings'));
  // Browser defaults supersede the earlier experimental preference once.
  const AI_PREFERENCE_VERSION = 4;
  config.aiMode = 'jev';
  config.aiSmallEncounter = false;
  try {
    const saved = JSON.parse(localStorage.getItem('tron-enemy-ai') || 'null');
    if (
      saved &&
      saved.version === AI_PREFERENCE_VERSION &&
      AI_MODES.includes(saved.mode)
    ) {
      config.aiMode = saved.mode;
      config.aiSmallEncounter = saved.version === AI_PREFERENCE_VERSION && saved.small === true;
    }
  } catch {}

  const session = loadingTimings.sync('Initial simulation / enemy placement',()=>new GameSession({ world: map }));
  const terminal = new Terminal($('terminal-text'), $('terminal-actions'));
  const tribute = new TerminalTribute($('end-tribute'), creditsText, extendedCreditsText);
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
  const openingDuration = 5.5, terminalFadeSeconds = 1.1, accessHoldSeconds = 1;
  let openingTime = 0, openingTransition = false, accessHoldTime = 0;
  let pausedFrom = 'running';

  const DEATH_TERMINAL = {
    holdSeconds: 1.1,
    fadeSeconds: 1,
    message: 'ILLEGAL CODE\nCLU PROGRAM DETACHED FROM SYSTEM',
  };
  const openingMessage = $('terminal-text').textContent;
  const cluAccessMessage = 'REQUEST ACCESS TO CLU PROGRAM\nCODE 6 PASSWORD TO MEMORY 0222';
  const accessPrinter = new HumanTerminalPrinter($('terminal-text'),cluAccessMessage);
  let deathElapsed = 0,
    outroFade = 0;
  let disposed = false;
  let tuningWasPlaying=false;
  const cycleTuning=import.meta.env.DEV?new CycleTuning({session,
    onOpen:()=>{tuningWasPlaying=['running','entering'].includes(mode);inputController.clear();releaseMouse();pause();},
    onClose:()=>{inputController.clear();if(tuningWasPlaying&&!disposed)resume();},
  }):null;
  let arenaLoad=null,solarLoad=null;
  function loadSolarInBackground(){
    if(solarLoad||!SOLAR_SAILER.enabled)return;
    solarLoad=loadingTimings.async('Solar sailer module + model',()=>import('../rendering/solar-sailer.js').then(async({loadSolarSailer,SolarSailer})=>({model:await loadSolarSailer(),SolarSailer}))).then(({model,SolarSailer})=>{
      if(disposed){disposeSceneResources(model.ship);return;}
      view.attachSolarSailer(model,SolarSailer);
    }).catch(error=>console.warn('Solar sailer unavailable:',error));
  }
  function loadArenaInBackground(){
    sound.loadCycleSamples();
    if(arenaLoad||!run.cycleRace)return;
    session.arenaReady=!!view.arena;
    if(view.arena)return;
    arenaLoad=loadingTimings.async('Arena module + models / cycle setup',()=>import('../rendering/arena.js').then(({loadArena})=>loadArena(map,[view.world.floor]))).then(arena=>{
      if(disposed){arena?.userData.cycleRace.shadows.dispose();arena?.userData.arenaStyle.dispose();if(arena)disposeSceneResources(arena);return;}
      loadingTimings.sync('Attach arena / floor',()=>view.attachArena(arena));session.arenaReady=true;
      loadingTimings.checkpoint('Arena assets ready');loadingTimings.print();
    }).catch(error=>{if(!disposed)fail('Unable to load the cycle arena. Please reload to retry. '+error.message);});
  }
  let mouseWasLocked = false;
  let inspectWasPaused = false;
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
    mode = next;
    if(['ready','error'].includes(next))document.body.classList.remove('cycle-intro','cycle-loading');
    if (next !== 'running') {
      clearMouseAim();
      releaseMouse();
    }
    idleTime = 0;
    loop.resetAccumulator();
    inputController.clearKeys();
    inputController.mouseFire = false;
    inputController.fireQueued = false;
    if (next !== 'running') sound.silence();
    $('overlay').hidden = next === 'running';
    $('loading').hidden = next !== 'loading';
    if (!view?.cameraRig.freeCamera.active) $('free-camera-help').hidden = true;
    $('intro').hidden = !['ready', 'entering'].includes(next);
    $('paused').hidden = next !== 'paused';
    $('error').hidden = next !== 'error';
    $('hud').hidden = !['running', 'paused'].includes(next);
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
    if(mode==='ready'&&selectedGame==='credits'){
      void sound.unlock().catch(e=>console.warn('Audio unavailable; continuing silently.',e.message));
      outroFade=0;startVictoryCredits();return;
    }
    if(mode==='ready'&&selectedGame==='bit'){
      window.location.assign(new URL('./bit/index.html',document.baseURI).href);
      return;
    }
    if (mode === 'entering') return;
    const fromTerminal = mode === 'ready',
      opening = fromTerminal && !(selectedGame === 'cycles' && run.cycleRace);
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
    const accessMessage=selectedGame==='space'?cluAccessMessage:openingMessage;
    $('terminal-text').textContent=accessMessage;
    $('terminal-text').parentElement.setAttribute('aria-label',accessMessage.replaceAll('\n','. '));
    outroFade = 0;
    controlsFirstKey = null;
    idleReminderArmed = false;
    deathElapsed = 0;
    $('death-fade').hidden = true;
    jev.resetScheduling();
    autoplay.reset();
    loadingTimings.checkpoint('Start requested');
    run = loadingTimings.sync('New game simulation reset',()=>session.reset());
    run.speed = config.maxSpeed;
    if(selectedGame==='cycles'&&run.cycleRace)session.requestCycleEntry({entranceFormation:!testCycleStart,startOutside:testCycleStart&&CYCLE_TESTING.startOutsideArena,startWithBreach:testCycleStart&&CYCLE_TESTING.startWithBreach,hideMiddleOpponent:testCycleStart&&CYCLE_TESTING.hideMiddleOpponent});
    else startPursuit(run);
    loadArenaInBackground();
    run.cruiseThrottle = true;
    session.previous = { ...run };
    view.reset();
    sound.reset();
    if(opening)sound.prepareMusic();
    view.cameraRig.aerial = false;
    view.cameraRig.aerialZoom = 1;
    openingTime=0;openingTransition=false;accessHoldTime=0;
    document.body.classList.remove('access-transition','access-ready');
    accessPrinter.reset();
    if(opening)accessPrinter.start();
    view.cameraRig.opening = null;
    document.body.classList.toggle('cycle-intro',selectedGame==='cycles'&&!testCycleStart);
    document.body.classList.toggle('cycle-loading',selectedGame==='cycles');
    document.body.style.setProperty('--opening-fade', '1');
    setMode(opening ? 'entering' : 'running');
    if(!opening&&!run.arenaWaiting)sound.startMusic();
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
    if (mode !== 'paused' || exitConfirm.open) return;
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

  const exitConfirm=window.createExitConfirm({
    onConfirm:()=>{setAutoplay(false);returnToProgramSelection();},
    onCancel:()=>{void resume();},
  });
  const gameChoices=[$('start'),$('start-cycles'),$('start-bit'),$('start-credits')];
  function selectGame(game,{focus=false}={}){
    selectedGame=game;
    for(const button of gameChoices){
      const selected=button.dataset.game===game;
      button.setAttribute('aria-pressed',String(selected));
      if(selected&&focus)button.focus({preventScroll:true});
    }
  }
  for(const button of gameChoices){
    listen(button,'focus',()=>selectGame(button.dataset.game));
    listen(button,'click',()=>{if(mode==='ready'&&!endingStage){selectGame(button.dataset.game);void start();}});
  }
  selectGame(selectedGame);
  listen(window,'click',event=>{
    if(mode==='entering'&&!openingTransition){event.preventDefault();event.stopImmediatePropagation();beginCluGame();return;}
    if(!creditsVisible())return;
    event.preventDefault();event.stopImmediatePropagation();returnToProgramSelection();
  },true);
  listen($('pause'), 'click', pause);
  listen($('sound'), 'click', mute);
  listen(window, 'keydown', (event) => {
    idleTime = 0;
    if(exitConfirm.open)return;
    if(event.code==='Escape'&&['running','entering','paused'].includes(mode)){
      event.preventDefault();
      if(!event.repeat){pause();if(cycleTuning?.open)cycleTuning.dialog.close();$('paused').hidden=true;exitConfirm.show();}
      return;
    }
    if (mode === 'loading') return;
    if(mode==='entering'&&!openingTransition){event.preventDefault();if(!event.repeat)beginCluGame();return;}
    if(creditsVisible()){event.preventDefault();if(!event.repeat)returnToProgramSelection();return;}
    if(mode==='ready'&&!endingStage&&!document.body.classList.contains('detached')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(event.code)){
      event.preventDefault();
      if(!event.repeat){
        if(event.code==='Enter')void start();
        else {
          const direction=['ArrowUp','ArrowLeft'].includes(event.code)?-1:1;
          const index=gameChoices.findIndex(button=>button.dataset.game===selectedGame);
          selectGame(gameChoices[(index+direction+gameChoices.length)%gameChoices.length].dataset.game,{focus:true});
        }
      }
      return;
    }
    if(mode==='running'&&(run.arenaWaiting||view.cameraRig.cycleOpening!==null)&&event.code!=='Escape'){event.preventDefault();return;}
    if(run.cycleSpectating&&['ArrowLeft','ArrowRight'].includes(event.code)){
      event.preventDefault();if(!event.repeat)followCycle(event.code==='ArrowLeft'?-1:1);return;
    }
    if(cycleTuning?.open)return;
    if(event.code==='Tab'&&cycleTuning&&run.playerVehicle==='cycle'&&['running','paused'].includes(mode)){
      event.preventDefault();if(!event.repeat)cycleTuning.show();return;
    }
    if (event.code === 'KeyC' && !event.ctrlKey && !event.metaKey && !event.altKey && ['running', 'entering', 'paused'].includes(mode)) {
      event.preventDefault();
      if(mode==='entering')finishOpening();
      if (!event.repeat) toggleInspection();
      return;
    }
    if(event.code==='Enter'&&!event.repeat&&run.playerVehicle==='cycle'&&session.restartCycleMatch()){
      event.preventDefault();inputController.clear();view.cameraRig.reset();view.cameraRig.aerial=false;
      if(mode==='paused')resume();return;
    }
    if (view?.cameraRig.freeCamera.active) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (event.code === 'Escape') { if (!event.repeat) toggleInspection(); }
      else if (event.code === 'Space') {
        if (!event.repeat) {
          if (mode === 'paused') resume(); else pause();
          $('overlay').hidden = true;
          $('free-camera-help').hidden = false;
        }
      }
      else if (event.code === 'Home' && view.arena) {
        const camera = view.camera;
        camera.position.copy(view.arena.position).add({ x: 700, y: 1000, z: 950 });
        camera.lookAt(view.arena.position);
        view.cameraRig.freeCamera.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
      } else keys.add(event.code);
      return;
    }
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
      CLU_AUTOPLAY_ENABLED && event.code === 'KeyU' && run.playerVehicle!=='cycle' &&
      !event.repeat &&
      ['running', 'entering', 'paused'].includes(mode)
    ) {
      event.preventDefault();
      setAutoplay(event.shiftKey ? !(autoplay.enabled && autoplay.manualFire) : !autoplay.enabled, event.shiftKey);
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
    if(run.playerVehicle==='cycle'&&!view.cameraRig.freeCamera.active&&['running','entering'].includes(mode)){
      if(['KeyW','KeyS','KeyX','KeyT'].includes(key)){
        event.preventDefault();keys.add(key);
        if(!event.repeat){
          if(key==='KeyX'&&run.cycleRace.cycles[run.cycleRace.playerId].escaped)inputController.cycleReverseQueued=Math.abs(run.cycleRace.cycles[run.cycleRace.playerId].roadSpeed)<.01;
        }
        return;
      }
      if(['KeyA','ArrowLeft','KeyD','ArrowRight'].includes(key)){
        event.preventDefault();keys.add(key);if(!event.repeat)inputController.cycleTurnQueued=['KeyA','ArrowLeft'].includes(key)?-1:1;return;
      }
      if(['KeyP','KeyF','KeyO','KeyT','Space'].includes(key)){event.preventDefault();return;}
    }
    if (
      !event.repeat &&
      ['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(key) &&
      ['running', 'entering'].includes(mode)
    )
      clearMouseAim();
    if (key === 'KeyW' && !event.repeat && ['running', 'entering'].includes(mode)) {
      run.cruiseThrottle = event.shiftKey ? true : false;
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
    const centerChord=run.playerVehicle!=='cycle'&&((key==='KeyJ'&&keys.has('KeyL'))||(key==='KeyL'&&keys.has('KeyJ')));
    if ((key === 'KeyF'||centerChord) && ['running', 'entering'].includes(mode)) {
      if(centerChord){event.preventDefault();keys.add(key);inputController.turretCenterChord=true;}
      clearMouseAim();
      run.gunnerLeveling = true;
      run.turretCentering = true;
      run.turretLocked = true;
      return;
    }
    if (key === 'KeyV' && ['running','entering'].includes(mode)) {
      if(mode==='entering')finishOpening();
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
      if (['KeyS', 'ArrowDown'].includes(key)) run.cruiseThrottle = false;
      keys.add(key);
    }
  });
  function followCycle(direction=1) {
    const survivors=run.cycleRace.cycles.filter(b=>b.alive);
    const index=survivors.findIndex(b=>b.id===run.cycleFollowId);
    run.cycleFollowId=survivors.length?survivors[(index<0?(direction<0?survivors.length-1:0):(index+direction+survivors.length)%survivors.length)].id:null;
    if(view.cameraRig.freeCamera.active)view.cameraRig.freeCamera.exit();
    view.cameraRig.freshCamera=true;
    inputController.clear();
  }
  function syncCycleSpectator() {
    if(run.playerVehicle!=='cycle')return;
    const dead=!run.cycleRace.cycles[run.cycleRace.playerId].alive;
    if(run.cycleSpectating&&(!dead||run.won||run.crushed)){
      if(view.cameraRig.freeCamera.active)view.cameraRig.freeCamera.exit();
      run.cycleSpectating=false;run.cycleFollowId=null;run.inspection=false;inputController.clear();
    }else if(dead&&!run.won&&!run.crushed&&!run.cycleSpectating){
      run.cycleSpectating=true;run.inspection=false;inspectWasPaused=false;
      inputController.clear();releaseMouse();clearMouseAim();run.cycleFollowId=null;
      if(view.cameraRig.freeCamera.active)view.cameraRig.freeCamera.exit();
    }
    if(run.cycleSpectating){
      if(run.cycleFollowId!=null&&!run.cycleRace.cycles.some(b=>b.alive&&b.id===run.cycleFollowId))followCycle();
      $('free-camera-help').hidden=true;
    }
  }
  function toggleInspection() {
    const camera = view.cameraRig.freeCamera;
    if (camera.active) {
      camera.exit();
      run.inspection = false;
      inputController.clearKeys();
      $('free-camera-help').hidden = true;
      if (inspectWasPaused) setMode('paused');
      else if (mode === 'paused') resume();
    } else {
      inspectWasPaused = mode === 'paused';
      if(!run.cycleSpectating)pause();
      camera.enter({spectator:!!run.cycleSpectating});
      run.inspection = !run.cycleSpectating;
      deathElapsed = 0;
      sound.fadeMusic(0);
      $('overlay').hidden = true;
      $('free-camera-help').hidden = false;
      if(!run.cycleSpectating)$('free-camera-help').textContent='FREE CAMERA · WASD move · Q/E down/up · drag / arrows look · Shift fast · Home arena · Space run/pause · C / Esc return';
    }
  }
  function setJevEnabled(enabled) {
    config.aiMode=enabled?'jev':'local';
    session.configure('vehicle',{aiMode:config.aiMode});
    jev.resetScheduling();
    if(!enabled&&autoplay.enabled)setAutoplay(false);
    if(import.meta.env.DEV)$('enemy-ai').value=config.aiMode;
    try{localStorage.setItem('tron-enemy-ai',JSON.stringify({version:AI_PREFERENCE_VERSION,mode:config.aiMode,small:config.aiSmallEncounter}));}catch{}
  }
  function setAutoplay(enabled, manualFire = false) {
    enabled=enabled&&CLU_AUTOPLAY_ENABLED;
    if(enabled&&config.aiMode!=='jev')setJevEnabled(true);
    autoplay.setEnabled(enabled, {manualFire});
    jev.resetScheduling();
    run.cruiseThrottle = false;
    inputController.clearKeys();
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
    inputController.release(e.code);
  });
  listen($('game'), 'pointerdown', (e) => {
    idleTime = 0;
    if (view?.cameraRig.freeCamera.active) return;
    if (run.gunner && !GUNNER.mouseEnabled) return;
    if ((mode === 'running'||mode==='entering'&&openingTransition) && e.button === 0) {
      if (run.gunner && document.pointerLockElement !== $('game')) {
        captureMouse();
        return;
      }
      inputController.mouseFire = true;
      inputController.fireQueued = true;
    }
  });
  listen(document, 'mousemove', (event) => {
    if(run.cycleSpectating&&['ArrowLeft','ArrowRight'].includes(event.code)){
      event.preventDefault();if(!event.repeat)followCycle(event.code==='ArrowLeft'?-1:1);return;
    }
    if(cycleTuning?.open)return;
    if (view?.cameraRig.freeCamera.active) {
      if (event.buttons === 1) view.cameraRig.freeCamera.look(event.movementX, event.movementY);
      return;
    }
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
      if (view?.cameraRig.freeCamera.active) { event.preventDefault(); return; }
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
        AERIAL_ZOOM.minScale,
        Math.min(
          AERIAL_ZOOM.maxScale,
          view.cameraRig.aerialZoom * Math.exp(Math.max(-600, Math.min(600, pixels)) * AERIAL_ZOOM.wheelExponentPerPixel),
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
    inputController.clearKeys();
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
      inputController.clearKeys();
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

  function creditsVisible(){
    return mode==='ready'&&(endingStage==='credits'||document.body.classList.contains('detached'));
  }
  function returnToProgramSelection(){
    sound.reset();tribute.reset();victoryPrinter.reset();accessPrinter.reset();
    jev.resetScheduling();autoplay.reset();inputController.clear();releaseMouse();
    run=session.reset();view.reset();view.cameraRig.opening=null;
    document.body.classList.remove('detached','victory','victory-credits');endingStage=null;
    $('terminal-text').textContent=openingMessage;
    $('terminal-text').parentElement.setAttribute('aria-label',openingMessage.replaceAll('\n','. '));
    deathElapsed=0;outroFade=0;openingTransition=false;openingTime=0;accessHoldTime=0;
    document.body.classList.remove('access-transition','access-ready');
    $('death-fade').hidden=true;
    selectGame(selectedGame);setMode('ready');
  }

  function startVictoryCredits(){
    endingStage='credits';victoryPrinter.reset();
    document.body.classList.remove('victory');document.body.classList.add('detached','victory-credits');
    $('terminal-text').textContent='';$('terminal-text').parentElement.setAttribute('aria-label','');
    sound.startMusic('terminal');tribute.start(view.cameraRig.reducedMotion);
  }

  function updateDeathTerminal(dt) {
    const fade = $('death-fade');
    if (view.cameraRig.freeCamera.active) { deathElapsed = 0; fade.hidden = true; return; }
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
          returnToProgramSelection();
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

  function beginCluGame(){
    if(mode!=='entering'||accessPrinter.active||openingTransition||accessHoldTime<accessHoldSeconds)return;
    inputController.clear();
    run.speed=config.maxSpeed;run.cruiseThrottle=true;
    sound.unlock().catch(e=>console.warn('Audio unavailable; continuing silently.',e.message));
    sound.startMusic();
    document.body.classList.remove('access-ready');
    if(view.cameraRig.reducedMotion)finishOpening();
    else {openingTransition=true;openingTime=0;view.cameraRig.opening=0;document.body.classList.add('access-transition');}
  }
  function finishOpening() {
    const held = [...keys],
      firing = inputController.mouseFire,
      queued = inputController.fireQueued;
    view.cameraRig.opening = null;
    accessPrinter.reset();openingTransition=false;
    document.body.classList.remove('access-transition','access-ready');
    setMode('running');
    for (const key of held) keys.add(key);
    inputController.mouseFire = firing;
    inputController.fireQueued = queued;
  }

  function frame(dt, background) {
    if (disposed) return;
    if(mode==='running'&&(run.playerVehicle!=='cycle'||run.cycleRace?.arenaPaused)&&run.time>=SOLAR_SAILER.backgroundLoadSeconds)loadSolarInBackground();
    if (run.crushed && run.mouseAim) clearMouseAim();
    if (!autoplay.enabled && (document.hidden || !windowFocused)) pause();
    if (mode === 'running') idleTime = keys.size || inputController.mouseFire ? 0 : idleTime + dt;
    if (mode === 'entering') {
      if(openingTransition){
        openingTime+=dt;
        view.cameraRig.opening=Math.min(1,openingTime/openingDuration);
        document.body.style.setProperty('--opening-fade',String(Math.max(0,1-openingTime/terminalFadeSeconds)));
        if(openingTime>=openingDuration||view.cameraRig.reducedMotion)finishOpening();
      }else if(accessPrinter.active)accessPrinter.update();
      else {accessHoldTime+=dt;beginCluGame();}
    }

    if((mode==='running'||mode==='entering'&&openingTransition)&&!run.gunner&&view.cameraRig.cycleOpening===null&&!view.cameraRig.freeCamera.active&&(run.playerVehicle==='cycle'||view.cameraRig.aerial)){
      const direction=Number(keys.has('KeyK'))-Number(keys.has('KeyI'));
      const rig=view.cameraRig,field=rig.aerial?'aerialZoom':'followZoom',limits=rig.aerial?AERIAL_ZOOM:FOLLOW_ZOOM;
      rig[field]=Math.max(limits.minScale,Math.min(limits.maxScale,rig[field]*Math.exp(direction*dt*limits.keyboardExponentPerSecond)));
    }
    view.cameraRig.cycleGlanceInput = mode === 'running' && !view.cameraRig.freeCamera.active
      ? Number(keys.has('KeyL')) - Number(keys.has('KeyJ')) : 0;
    if(mode==='running'&&view.cameraRig.cycleOpening!==null&&(!sound.context||sound.cycleSamplesReady)){
      view.cameraRig.cycleOpening+=dt/CYCLE_OPENING.durationSeconds;
      if(view.cameraRig.cycleOpening>=1+CYCLE_OPENING.formationSeconds/CYCLE_OPENING.durationSeconds){
        run.cycleRace.remaining=0;
      }
      if(view.cameraRig.cycleOpening>=1+(CYCLE_OPENING.formationSeconds+CYCLE_OPENING.launchHoldSeconds)/CYCLE_OPENING.durationSeconds){
        view.cameraRig.finishCycleOpening();
        inputController.clear();
        document.body.classList.remove('cycle-intro');
      }
    }
    if (mode === 'running'||mode==='entering'&&openingTransition) {
      if (frameTimes.length >= 3600) frameTimes.shift();
      if (dt > 0) frameTimes.push(dt * 1000);
      loop.advance(
        dt,
        background,
        () => !run.won && (view.cameraRig.cycleOpening===null||!sound.context||sound.cycleSamplesReady) && (mode === 'running' || mode === 'entering'),
        (fixedStep) => {
          let command = inputController.command(run, {
            mouseLook: view.cameraRig.mouseLook,
            mouseTarget: view.mouseTarget,
          });
          if (view.cameraRig.freeCamera.active) command = { ...command, cycleTurbo: false, cycleSlow: false, cycleRoad: {}, throttle: 0, steer: 0, fire: false, firePressed: false, mouseTarget: null, turret: 0, aimPitch: 0 };
          if (autoplay.enabled)
            command = mergeAutoplayInput(autoplay.input(run), command, view.cameraRig.freeCamera.active ? new Set() : keys, run);
          const events = session.advance(command, fixedStep, {holdCycleRace:view.cameraRig.cycleOpening!==null&&view.cameraRig.cycleOpening<1+CYCLE_OPENING.formationSeconds/CYCLE_OPENING.durationSeconds});
          inputController.consume();
          for (const event of events) {
            if(event.type==='cycleArrival'){loadingTimings.checkpoint('Player entered cycle arena');loadingTimings.print();}
            if(event.type==='cycleArrival'||event.type==='cycleRetry'){
              setAutoplay(false);inputController.clear();releaseMouse();clearMouseAim();view.cameraRig.reset();view.cameraRig.aerial=false;
              document.body.classList.remove('cycle-loading');
              if(event.type==='cycleArrival'&&document.body.classList.contains('cycle-intro')&&!view.cameraRig.reducedMotion){
                view.cameraRig.cycleOpening=CYCLE_OPENING.startSeconds/CYCLE_OPENING.durationSeconds;
                // Advance the patrol through the skipped opening with bounded steps.
                for(let remaining=CYCLE_OPENING.startSeconds;remaining>0;remaining-=fixedStep)
                  session.advance({},Math.min(fixedStep,remaining),{holdCycleRace:true});
              }
              else document.body.classList.remove('cycle-intro');
            }
            view.event(event);
            sound.effect(event.type, event);
          }
        },
        simulationStepSeconds(run),
      );
    }
    jev.update(run, !run.arenaWaiting && (run.playerVehicle!=='cycle'||run.cycleRace?.arenaPaused) && !run.won && mode === 'running', autoplay);
    if (!autoplay.enabled && (document.hidden || !windowFocused)) pause();
    if (view && mode !== 'error') {syncCycleSpectator();updateDeathTerminal(dt);}
    if (view && mode !== 'error') {
      view.cameraRig.freeCamera.update(dt, keys);
      if (!document.hidden && !(mode==='ready'&&endingStage==='victory'))
        view.render(run, session.previous, mode === 'running' ? loop.alpha : 1, dt, mode);
      sound.cycleOpeningSeconds=view.cameraRig.cycleOpening===null?null:view.cameraRig.cycleOpening*CYCLE_OPENING.durationSeconds;
      sound.cycleOpeningAudio?.update(sound.cycleOpeningSeconds,mode==='running');
      sound.update(run, view.camera, mode === 'running'||mode==='entering'&&openingTransition);
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
      await loadingTimings.async('Wait for physics initialization',()=>debrisPhysicsReady);
      const context = loadingTimings.sync('Create WebGL2 context',()=>$('game').getContext('webgl2', {
        stencil: true,
        antialias: true,
        powerPreference: 'high-performance',
      }));
      if (!context)
        throw new Error(
          'This game needs WebGL 2. Try a current desktop browser with hardware acceleration enabled.',
        );
      performance.mark('tron:assets-start');
      const [[tank, recognizer], carrier, cloud] = await Promise.all([
        loadingTimings.async('Tank + Recognizer models (fetch, decode, adapt)',()=>loadVehicles()),
        loadingTimings.async('Carrier model (fetch, decode, adapt)',()=>loadCarrier()),
        loadingTimings.async('Cloud model (fetch, decode, adapt)',()=>loadCloud()),
      ]);
      performance.mark('tron:assets-ready');
      const physics = loadingTimings.sync('Create debris physics world',()=>new DebrisPhysics(map.nearbyWalls));
      view = loadingTimings.sync('Build rendering world / meshes / shadows',()=>new View($('game'), tank, recognizer, carrier, cloud, map, physics));
      performance.mark('tron:world-ready');
      session.arenaReady=!run.cycleRace;
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

      // Warm the first scene frame while the loading terminal still covers it.
      loadingTimings.sync('First render submission / shader setup',()=>view.render(run, session.previous, 1, 0, 'ready'));
      performance.mark('tron:first-frame');
      $('start').disabled = false;
      $('start-cycles').disabled = false;
      $('start-bit').disabled = false;
      $('start-credits').disabled = false;
      terminal.finish();
      setMode('ready');
      loadingTimings.checkpoint('Opening terminal ready');
      loadingTimings.print();
      requestAnimationFrame(()=>{if(!disposed)loadingTimings.checkpoint('Frame callback after opening ready');});
      loop.start();
      if(testCycleStart&&run.cycleRace)void start().catch(error=>{if(!disposed)fail(error.message);});
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
      maneuverSpeedMetersPerSecond: [1, 6, 0.25, 'm/s'],
      sidewaysSpeedRatio: [0.1, 1, 0.05, '×'],
      reverseSpeedRatio: [0.1, 1, 0.05, '×'],
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
    const tintFields=document.createElement('fieldset');
    tintFields.innerHTML='<legend>Recognizer face tints</legend>';
    const tintInputs=[];
    for(const [key,title] of [['recognizerTintColor','Default'],['arenaPatrolTintColor','Arena patrol']]){
      const label=document.createElement('label');
      label.innerHTML=`<span>${title}</span><input type="color" aria-label="${title} face tint"><select aria-label="${title} tint preset">${Object.keys(RECOGNIZER_TINTS).map(name=>`<option>${name}</option>`).join('')}</select>`;
      const input=label.querySelector('input'),select=label.querySelector('select');
      const sync=()=>{input.value='#'+config[key].toString(16).padStart(6,'0');select.value=Object.keys(RECOGNIZER_TINTS).find(name=>RECOGNIZER_TINTS[name]===config[key])??'';};
      const change=color=>{config[key]=color;session.configure('vehicle',{[key]:color});sync();};
      listen(input,'input',()=>change(parseInt(input.value.slice(1),16)));
      listen(select,'change',()=>change(RECOGNIZER_TINTS[select.value]));
      sync();tintInputs.push(sync);tintFields.append(label);
    }
    $('sliders').after(tintFields);
    listen($('reset-tuning'), 'click', () => {
      Object.assign(config, defaults, {
        aiMode: config.aiMode,
        aiSmallEncounter: config.aiSmallEncounter,
      });
      tintInputs.forEach(sync=>sync());
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
    cycleTuning?.dispose();
    exitConfirm.dispose();
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
