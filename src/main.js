import {HEARING,HEARING_DEFAULTS} from './game/hearing.js';
import {JevClient} from './ai/jev-client.js';
import {SystemWarnings} from './ui/system-warnings.js';
import {AI_MODES} from './game/tactical.js';
import creditsText from '../docs/credits.txt?raw';
import {debrisVehicleTargets,applyDebrisImpacts} from './simulation/debris-damage.js';
import {debrisPhysicsReady} from './rendering/debris-physics.js';
import {loadCloud} from './rendering/cloud-layer.js';
import {saveScreenshot} from './ui/screenshot.js';
import {loadCarrier} from './rendering/carrier.js';
import { loadVehicles } from './rendering/models.js';
import { Terminal, TerminalTribute } from './ui/terminal.js';
import { View } from './rendering/view.js';
import { Sound } from './audio/sound.js';
import {FLIGHT,FLIGHT_DEFAULTS} from './simulation/flight.js';
import { createRun, step, startPursuit, boostTank } from './simulation/run.js';
import { WALLS, HALF, BASIS, MAZE_KIND } from './levels/maze.js';
import { config, defaults, TURBO, CLU_HEALTH, GUNNER } from './game/config.js';

const $ = id => document.getElementById(id);
const sound = new Sound();
const jev=new JevClient();
const systemWarnings=new SystemWarnings($('system-warnings'));
// Browser defaults supersede the earlier experimental preference once.
const AI_PREFERENCE_VERSION=3;
config.aiMode='jev';config.aiSmallEncounter=false;
try{const saved=JSON.parse(localStorage.getItem('tron-enemy-ai')||'null');if(saved&&[2,AI_PREFERENCE_VERSION].includes(saved.version)&&AI_MODES.includes(saved.mode)){config.aiMode=saved.mode;config.aiSmallEncounter=saved.version===AI_PREFERENCE_VERSION&&saved.small===true;}}catch{}

const terminal = new Terminal($('terminal-text'), $('terminal-actions'));
const tribute = new TerminalTribute($('end-tribute'),creditsText);
let view, run = createRun(), previous = { ...run }, mode = 'loading';
let showSurvey = false,idleTime=0;
let controlsFirstKey=null,idleReminderArmed=false;
function noteControlKey(){if(controlsFirstKey===null)controlsFirstKey=run.time;else if(run.time-controlsFirstKey>=10)idleReminderArmed=true;}
let openingTime=0,pausedFrom='running',startingThrottle=false;
const openingDuration=5.5;
const HEALTH_WARNING={orange:.5,red:.25,critical:.1};
const DEATH_TERMINAL={holdSeconds:1.1,fadeSeconds:1,message:'ILLEGAL CODE\nCLU PROGRAM DETACHED FROM SYSTEM'};
const openingMessage=$('terminal-text').textContent;
let deathElapsed=0,outroFade=0;
let accumulator = 0, lastTime = 0, frameId, disposed = false, mouseFire = false,fireQueued=false;
let mouseTarget=null,mouseWasLocked=false;
const GUNNER_WHEEL={threshold:40,intervalMs:180,resetMs:250};
let zoomWheelDelta=0,zoomWheelTime=-Infinity,zoomWheelStep=-Infinity;
const keys = new Set(), cleanups = [], frameTimes = [];
const fixedStep = 1 / 60;
function listen(object, event, fn, options) { object.addEventListener(event, fn, options); cleanups.push(() => object.removeEventListener(event, fn, options)); }
const timeLabel = t => `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(Math.floor(t % 60)).padStart(2,'0')}`;

function clearMouseAim(){mouseTarget=null;if(view){view.mouseLook=null;view.mouseTarget=null;}run.mouseAim=null;run.gunnerYawMotion=run.gunnerPitchMotion=0;run.turretHeading=run.yaw+run.turretYaw;}
function releaseMouse(){if(document.pointerLockElement===$('game'))document.exitPointerLock();}
function captureMouse(){try{$('game').requestPointerLock()?.catch(()=>{});}catch{}}
function setMode(next) {
  if(next==='paused'||next==='error')startingThrottle=false;
  mode = next;if(next!=='running'){clearMouseAim();releaseMouse();}idleTime=0; accumulator = 0; keys.clear(); mouseFire = false;fireQueued=false;
  if (next !== 'running') sound.silence();
  $('overlay').hidden = next === 'running';
  $('intro').hidden = !['ready','entering'].includes(next); $('paused').hidden = next !== 'paused';
  $('error').hidden = next !== 'error';
  $('hud').hidden = !['running','entering','paused'].includes(next);
  $('pause').hidden = next !== 'running'; $('footer').hidden = next !== 'ready';
  document.body.classList.toggle('playing', next === 'running');
  document.body.classList.toggle('terminal', ['ready','entering'].includes(next));
  document.body.classList.toggle('entering', next === 'entering');
  document.body.classList.toggle('paused',next==='paused');
  if(next==='running')document.body.classList.remove('detached');
  if (next === 'paused') $('paused').focus({preventScroll:true});
}

async function start() {
  if(mode==='entering')return;
  const fromTerminal=mode==='ready',opening=fromTerminal&&!view.reducedMotion;
  // Request both context and media playback before yielding the Return gesture.
  let audioReady;
  try{audioReady=sound.unlock().catch(e=>console.warn('Audio unavailable; continuing silently.',e.message));}catch(e){console.warn('Audio unavailable; continuing silently.',e.message);}
  if (disposed || mode === 'error') return;
  tribute.reset();outroFade=0;controlsFirstKey=null;idleReminderArmed=false;deathElapsed=0;$('death-fade').hidden=true;
  jev.reset();run = createRun(config.aiMode==='classic'?undefined:1982);run.speed=config.maxSpeed;startPursuit(run);startingThrottle=true; previous = { ...run }; view.reset(); sound.reset();view.aerial=false;view.aerialZoom=1;openingTime=0;view.opening=opening?0:null;
  document.body.style.setProperty('--opening-fade','1');
  setMode(opening?'entering':'running');sound.startMusic();
  await audioReady;
  if(fromTerminal&&!disposed&&['entering','running'].includes(mode))sound.terminalTone('access');
}
function pause() { if (mode === 'running'||mode==='entering'){pausedFrom=mode;setMode('paused');} }
async function resume() {
  if(mode!=='paused')return;
  setMode(pausedFrom);
  const audioReady=sound.unlock().catch(()=>{});sound.resumeMusic();
  await audioReady;
  if(!['running','entering'].includes(mode))sound.silence();
}
function mute() { sound.muted = !sound.muted; $('sound').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON'; $('sound').setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound'); }
function fail(message) { $('error-message').textContent = message; setMode('error'); }

listen($('start'), 'click', start);
listen($('pause'), 'click', pause); listen($('sound'), 'click', mute);
listen(window, 'keydown', event => {
  idleTime=0;
  if(mode==='loading')return;
  if(['F9','KeyB'].includes(event.code)&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&view&&['running','entering','paused'].includes(mode)){event.preventDefault();if(!event.repeat)saveScreenshot(view,$('game'));return;}
  if(['running','entering'].includes(mode)&&!event.repeat)noteControlKey();
  if(mode==='ready')sound.unlock().catch(()=>{});
  if(mode==='paused'){
    event.preventDefault();
    if(!event.repeat){
      resume();
      if(event.code==='KeyW')run.cruiseThrottle=event.shiftKey;
      if(['running','entering'].includes(mode)&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyI','KeyJ','KeyK','KeyL'].includes(event.code))keys.add(event.code);
    }
    return;
  }
  if (event.target instanceof HTMLInputElement) return;
  const key = event.code;
  if(!event.repeat&&['KeyI','KeyJ','KeyK','KeyL'].includes(key)&&['running','entering'].includes(mode))clearMouseAim();
  if(key==='KeyW'&&!event.repeat&&['running','entering'].includes(mode)){run.cruiseThrottle=event.shiftKey?true:false;if(!event.shiftKey)startingThrottle=false;}
  if(!event.repeat&&['running','entering'].includes(mode)&&key==='KeyP'){
    if(mode==='entering')finishOpening();run.gunner=!run.gunner;clearMouseAim();if(!run.gunner)releaseMouse();view.aerial=false;view.freshCamera=view.reducedMotion;return;
  }
  if(!event.repeat&&['running','entering'].includes(mode)&&key==='KeyO'&&run.gunner){run.gunnerZoom=run.gunnerZoom+1<GUNNER.fovs.length?run.gunnerZoom+1:GUNNER.minZoom;return;}
  if (['running','entering'].includes(mode) && ['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) event.preventDefault();
  if (key === 'Tab' && mode === 'running') { event.preventDefault(); if (!event.repeat) showSurvey = !showSurvey; return; }
  if (event.repeat) return;
  if(key==='KeyF'&&['running','entering'].includes(mode)){clearMouseAim();run.gunnerLeveling=true;run.turretCentering=true;run.turretLocked=true;return;}
  if (key === 'KeyV' && mode === 'running') { run.gunner=false;clearMouseAim();releaseMouse();view.aerial = !view.aerial; view.freshCamera = view.reducedMotion; return; }
  if (key === 'Enter' && mode === 'ready') { event.preventDefault(); terminal.done ? start() : terminal.finish(); return; }
  if(mode==='entering'&&key==='Enter'){event.preventDefault();finishOpening();return;}
  if (key === 'Escape') { ['running','entering'].includes(mode) ? pause() : resume(); return; }
  if (key === 'KeyM') { mute(); return; }
  if(key==='KeyT'){
    if(event.shiftKey&&import.meta.env.DEV){$('tuning').hidden=!$('tuning').hidden;return;}
    if(['running','entering'].includes(mode))boostTank(run);
    return;
  }
  if (['running','entering'].includes(mode)){if(key==='Space')fireQueued=true;if(['KeyS','ArrowDown'].includes(key))startingThrottle=false;keys.add(key);}
});
listen(window, 'keyup', e => {idleTime=0;keys.delete(e.code);if(e.code==='KeyW')startingThrottle=false;});
listen($('game'), 'pointerdown', e => {idleTime=0;if(run.gunner&&!GUNNER.mouseEnabled)return;if(['running','entering'].includes(mode)&&e.button===0){if(run.gunner&&document.pointerLockElement!==$('game')){captureMouse();return;}mouseFire=true;fireQueued=true;} });
listen(document,'mousemove',event=>{
 if(!GUNNER.mouseEnabled||mode!=='running'||!run.gunner||run.crushed||document.pointerLockElement!==$('game'))return;
 if(!event.movementX&&!event.movementY)return;
 view.moveMouseAim(event.movementX,event.movementY,run);idleTime=0;
});
listen(document,'pointerlockchange',()=>{
 const locked=document.pointerLockElement===$('game');
 if(mouseWasLocked&&!locked){clearMouseAim();mouseFire=false;fireQueued=false;if(run.gunner&&!run.crushed&&mode==='running')pause();}
 mouseWasLocked=locked;
});
listen($('game'),'wheel',event=>{
  if(run.gunner&&!GUNNER.mouseEnabled){event.preventDefault();return;}
  if(!(view?.aerial||run.gunner)||!['running','paused'].includes(mode)||event.ctrlKey)return;
  event.preventDefault();idleTime=0;
  const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
  if(run.gunner){
    const now=performance.now();
    if(now-zoomWheelTime>GUNNER_WHEEL.resetMs||Math.sign(pixels)!==Math.sign(zoomWheelDelta))zoomWheelDelta=0;
    zoomWheelTime=now;zoomWheelDelta+=pixels;
    if(Math.abs(zoomWheelDelta)>=GUNNER_WHEEL.threshold&&now-zoomWheelStep>=GUNNER_WHEEL.intervalMs){
      run.gunnerZoom=Math.max(GUNNER.minZoom,Math.min(GUNNER.fovs.length-1,run.gunnerZoom-Math.sign(zoomWheelDelta)));
      zoomWheelDelta=0;zoomWheelStep=now;
    }
    return;
  }
  view.aerialZoom=Math.max(.25,Math.min(4,view.aerialZoom*Math.exp(Math.max(-600,Math.min(600,pixels))*.0015)));
},{passive:false});
listen(window, 'pointerup', () => { mouseFire = false; });
listen(window, 'blur', () => { keys.clear(); mouseFire = false;fireQueued=false; pause(); });
listen(document, 'visibilitychange', () => { if (document.hidden) pause(); });
listen(window, 'resize', () => view?.resize());
listen($('game'), 'webglcontextlost', event => { event.preventDefault(); fail('The graphics connection was interrupted. Reload to reconnect.'); });

const mapContext = $('map').getContext('2d');
function drawMap() {
  const ctx=mapContext,w=500,h=500,scale=440/(2*HALF*(BASIS.a+BASIS.b));
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#020710e8';ctx.fillRect(0,0,w,h);ctx.fillStyle='#253e62';
  for(const wall of WALLS){ctx.beginPath();wall.points.forEach((p,i)=>{const x=250+p.x*scale,y=250-p.s*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}
  const px=250+run.x*scale,py=250-run.s*scale;
  ctx.save();ctx.translate(px,py);ctx.rotate(-run.yaw);ctx.fillStyle='#e8ad78';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-4,5);ctx.lineTo(4,5);ctx.closePath();ctx.fill();ctx.restore();

}
function updateHud() {
  $('gunner-sight').hidden=!(view.gunnerOpacity>0)||run.crushed||!['running','paused'].includes(mode);
  $('gunner-sight').style.opacity=String((view.gunnerOpacity||0)*(mode==='paused'?.35:1));
  const point=view.gunScreen,scale=Math.min(innerWidth/1000,innerHeight/650);
  $('gunner-crosshair').setAttribute('transform',point?`translate(${point.x*innerWidth/2/scale} ${-point.y*innerHeight/2/scale})`:'');
  $('aim-dot').hidden=!view.mouseLook;
  $('mouse-hint').textContent=!GUNNER.mouseEnabled||document.pointerLockElement===$('game')?'':'CLICK / MOUSE AIM';
  $('gunner-sight').classList.toggle('on-target',!!view.gunnerHit);
  $('gunner-sight').classList.toggle('critical-target',!!view.gunnerHit?.critical);
  $('gunner-zoom').textContent=['1×','2×','4×','8×'][run.gunnerZoom];
  $('zoom-hint').hidden=!(view.aerial||(GUNNER.mouseEnabled&&run.gunner));
  $('survey').hidden=!showSurvey;
  systemWarnings.set('jev',config.aiMode==='jev'?jev.warning:{level:'warning',label:'JEV OFF',detail:config.aiMode==='classic'?'Classic enemy AI selected.':'Local tactical AI selected.'});
  const healthFraction=run.crushed?0:Math.max(0,Math.min(1,run.health/CLU_HEALTH.max)),healthPercent=Math.ceil(healthFraction*100);
  $('health-fill').style.transform=`scaleX(${healthFraction})`;
  $('health-meter').setAttribute('aria-valuenow',String(healthPercent));
  $('clu-health').dataset.level=healthFraction<=HEALTH_WARNING.critical?'critical':healthFraction<=HEALTH_WARNING.red?'red':healthFraction<=HEALTH_WARNING.orange?'orange':'normal';
  const turbo=$('turbo'),boosting=run.turboRemaining>0,charging=run.turboCooldown>0;
  turbo.setAttribute('aria-label',boosting?'Turbo active':charging?'Turbo recharging':'Turbo ready');
  turbo.classList.toggle('boosting',boosting);turbo.classList.toggle('charging',charging);
  $('turbo-fill').style.transform=`scaleX(${boosting?run.turboRemaining/TURBO.duration:1-run.turboCooldown/TURBO.rechargeSeconds})`;
  const openingControls=controlsFirstKey===null||run.time-controlsFirstKey<10;
  $('hint').classList.toggle('faded',!['running','entering'].includes(mode)||!(openingControls||idleReminderArmed&&idleTime>=3));
  document.body.classList.toggle('impact',run.impact>.6&&!view.reducedMotion);
  if(showSurvey)drawMap();
  if(import.meta.env.DEV&&!$('tuning').hidden) {
    $('ai-status').textContent=jev.status;
    $('ai-decision').textContent=JSON.stringify(jev.history.at(-1)||{mode:config.aiMode,units:[...run.recognizers,...run.enemyTanks].map(e=>({id:e.id,maneuver:e.tactical?.plan?.kind,source:e.tactical?.source,blocked:e.tactical?.blocked}))},null,2);
    $('perception').textContent=run.recognizers.map(e=>`R${e.id+1} ${e.state} | ${e.canSee?'visual':e.memory?`last seen ${(run.time-e.memory.seenAt).toFixed(1)}s ago via R${e.memory.source+1}`:'no sighting'}`).join('\n');
  }
}

function updateDeathTerminal(dt){
  const fade=$('death-fade');
  if(mode==='ready'&&run.crushed){
    const music=sound.music;
    const signOffReady=sound.musicMode==='terminal'&&(music?.ended||(Number.isFinite(music?.duration)&&music.currentTime>=music.duration-5)||!!sound.musicError);
    if(tribute.update(dt,signOffReady))sound.endOfLine();
    if(!tribute.active&&tribute.phase==='signoff'){
      outroFade+=dt;fade.hidden=false;fade.style.opacity=String(Math.min(1,outroFade/5));
      if(outroFade>=5){
        sound.reset();tribute.reset();run=createRun();previous={...run};view.reset();view.opening=null;
        document.body.classList.remove('detached');$('terminal-text').textContent=openingMessage;
        $('terminal-text').parentElement.setAttribute('aria-label',openingMessage.replace('\n','. '));
        deathElapsed=0;outroFade=0;setMode('ready');fade.hidden=true;
        $('terminal-text').parentElement.animate([{opacity:0},{opacity:1}],{duration:500});
      }
    }
    return;
  }
  if(!run.crushed){deathElapsed=0;fade.hidden=true;return;}
  if(!['running','entering'].includes(mode))return;
  deathElapsed+=dt;
  sound.fadeMusic(deathElapsed/(DEATH_TERMINAL.holdSeconds+DEATH_TERMINAL.fadeSeconds));
  const amount=Math.max(0,Math.min(1,(deathElapsed-DEATH_TERMINAL.holdSeconds)/DEATH_TERMINAL.fadeSeconds));
  fade.hidden=amount===0;fade.style.opacity=String(amount);
  if(amount<1)return;
  view.opening=null;document.body.style.setProperty('--opening-fade','1');
  $('terminal-text').textContent=DEATH_TERMINAL.message;
  const copy=$('terminal-text').parentElement;copy.setAttribute('aria-label',DEATH_TERMINAL.message.replace('\n','. '));
  document.body.classList.add('detached');setMode('ready');sound.startMusic('terminal');tribute.start(view.reducedMotion);fade.hidden=true;
  copy.animate([{opacity:0},{opacity:1}],{duration:view.reducedMotion?0:500});
}

function finishOpening(){const held=[...keys],firing=mouseFire,queued=fireQueued;view.opening=null;openingTime=openingDuration;setMode('running');for(const key of held)keys.add(key);mouseFire=firing;fireQueued=queued;}

function frame(ms) {
  if (disposed) return;
  if(run.crushed&&run.mouseAim)clearMouseAim();
  const dt = Math.min(0.1, (ms - (lastTime || ms)) / 1000); lastTime = ms;
  if(mode==='running')idleTime=keys.size||mouseFire?0:idleTime+dt;
  if(mode==='entering'){
    openingTime+=dt;view.opening=Math.min(1,openingTime/openingDuration);
    document.body.style.setProperty('--opening-fade',String(Math.max(0,1-openingTime/1.1)));
    if(openingTime>=openingDuration||view.reducedMotion)finishOpening();
  }
  if (mode === 'running'||mode==='entering') {
    if (frameTimes.length >= 3600) frameTimes.shift(); if (dt > 0) frameTimes.push(dt * 1000);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= fixedStep && steps++ < 6 && (mode === 'running'||mode==='entering')) {
      previous = { x: run.x, s: run.s, yaw: run.yaw, turretYaw: run.turretYaw,aimPitch:run.aimPitch };
      const input = {
        throttle: keys.has('KeyS')||keys.has('ArrowDown')?-1:Number(startingThrottle||run.cruiseThrottle||keys.has('KeyW')||keys.has('ArrowUp')),
        steer: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        mouseTarget:view.mouseLook?view.mouseTarget:mouseTarget,
        firePressed:fireQueued,
        fire: keys.has('Space') || mouseFire || fireQueued,
        turret: Number(keys.has('KeyL')) - Number(keys.has('KeyJ')),
        aimPitch:run.gunner?Number(keys.has('KeyI'))-Number(keys.has('KeyK')):0,
      };
      step(run, input, fixedStep);mouseTarget=null;fireQueued=false; accumulator -= fixedStep;
      view.breakups.physics.syncVehicles(debrisVehicleTargets(run));
      view.breakups.update(fixedStep);
      applyDebrisImpacts(run,view.breakups.physics.drainImpacts());
      for (const event of run.events.splice(0)) { view.event(event); sound.effect(event.type,event); }
    }
  }
  jev.update(run,mode==='running'||mode==='entering');
  if(view&&mode!=='error')updateDeathTerminal(dt);
  if (view && mode !== 'error') {
    view.render(run, previous, mode === 'running' ? accumulator / fixedStep : 1, dt, mode);
    sound.update(run, view.camera, mode === 'running'||mode==='entering');
    updateHud();
  }
  frameId = requestAnimationFrame(frame);
}

async function initialize() {
try {
  await debrisPhysicsReady;
  const context = $('game').getContext('webgl2',{stencil:true,antialias:true,powerPreference:'high-performance'});
  if (!context) throw new Error('This game needs WebGL 2. Try a current desktop browser with hardware acceleration enabled.');
  const [[tank, recognizer],carrier,cloud] = await Promise.all([loadVehicles(),loadCarrier(),loadCloud()]);
  view = new View($('game'), tank, recognizer, carrier,cloud);
  if (disposed) { view.dispose(); return; }
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  view.reducedMotion=motionPreference.matches;
  listen(motionPreference,'change',e=>{view.reducedMotion=e.matches;});

  $('start').disabled = false; $('start').querySelector('span').textContent = 'ENTER THE MAZE';
  terminal.finish();setMode('ready'); frameId = requestAnimationFrame(frame);
} catch (error) { console.error(error); if (!disposed) fail(error.message); }
}

if (import.meta.env.DEV) {
  $('enemy-ai').value=config.aiMode;$('ai-small-encounter').checked=config.aiSmallEncounter;
  listen($('apply-ai'),'click',()=>{
    config.aiMode=$('enemy-ai').value;config.aiSmallEncounter=$('ai-small-encounter').checked;
    try{localStorage.setItem('tron-enemy-ai',JSON.stringify({version:AI_PREFERENCE_VERSION,mode:config.aiMode,small:config.aiSmallEncounter}));}catch{}
    jev.reset();start();
  });
  const ranges = { aiConfidence:[0,1,.05], acceleration:[4,20,.5], braking:[8,35,1], maxSpeed:[15,40,1], steering:[.4,2.5,.05], cameraDistance:[10,30,1], cameraHeight:[4,14,.5], cameraLag:[2,15,.5], fov:[45,85,1], enemySpeed:[10,45,1], bloom:[0,1,.05], fog:[.001,.009,.0002], renderScale:[.5,1,.1] };
  const flightRanges={turnRate:[.1,1.2,.02,'rad/s'],turnAcceleration:[.1,2,.05,'rad/s²'],liftAcceleration:[2,30,1,'m/s²'],liftSpeed:[5,35,1,'m/s']};
  const hearingRanges={engineMovingRangeMeters:[40,200,5],cannonRangeMeters:[200,1200,25],explosionRangeMeters:[300,1600,25]};
  const tuningFields=[...Object.entries(hearingRanges).map(([key,range])=>({key,range,target:HEARING,title:`Hearing ${key} (m)`})),...Object.entries(ranges).map(([key,range])=>({key,range,target:config,title:key})),...Object.entries(flightRanges).map(([key,range])=>({key,range,target:FLIGHT,title:`Recognizer ${key} (${range[3]})`}))];
  for (const {key,range:[min,max,stepSize],target,title} of tuningFields) {
    const label = document.createElement('label'); label.innerHTML = `<span>${title}</span><output>${target[key]}</output><input type="range" min="${min}" max="${max}" step="${stepSize}" value="${target[key]}">`;
    listen(label.querySelector('input'), 'input', e => { target[key] = Number(e.target.value); label.querySelector('output').value = target[key]; if(key === 'renderScale') view.resize(); });
    $('sliders').append(label);
  }
  listen($('reset-tuning'), 'click', () => { Object.assign(config, defaults,{aiMode:config.aiMode,aiSmallEncounter:config.aiSmallEncounter}); Object.assign(FLIGHT,FLIGHT_DEFAULTS);Object.assign(HEARING,HEARING_DEFAULTS); view.resize(); [...$('sliders').children].forEach((label,i) => { const {target,key}=tuningFields[i],v=target[key];label.querySelector('input').value=v;label.querySelector('output').value=v; }); });
  listen($('export-tuning'), 'click', () => navigator.clipboard.writeText(JSON.stringify({...config,recognizerFlight:FLIGHT},null,2)));
  // Development-only observability/scenario placement; outcomes still run through step().
  window.__tron = {
    get state() { return { ...run,aiMode:config.aiMode,aiStatus:jev.status,aiHistory:jev.history, recognizerFlight:{...FLIGHT}, mode, opening:view.opening, carrier:view.carrier?.position.toArray(),tankVisible:view.tank.root.visible,enemyTankVisuals:view.enemyTanks.map(c=>({visible:c.root.visible,turretYaw:c.turret.rotation.y,barrelPitch:c.barrel.rotation.x})),searchlights:view.searchlights.beams.map(b=>({visible:b.mesh.visible,length:b.length,strength:b.strength})), gunnerHit:view.gunnerHit,enemyOutlines:view.enemyOutline.enabled,camera:{rotation:view.camera.quaternion.toArray(),gunnerTransition:!!view.gunnerTransition,gunnerOpacity:view.gunnerOpacity,fov:view.camera.fov,x:view.camera.position.x,y:view.camera.position.y,z:view.camera.position.z}, maze:MAZE_KIND,carrierBeamVisuals:view.carrierLights.beams.map(b=>({visible:b.mesh.visible,length:b.length,strength:b.strength})),beamVisuals:view.dataBeams.beams.map(b=>({visible:b.visible,opacity:b.children[0].material.opacity,color:b.children[0].material.color.getHex(),curtain:b.userData.effects.curtain.visible,waveRadius:b.userData.effects.ring.scale.x})), recognizers: run.recognizers.map(e=>({...e,memory:e.memory?{...e.memory}:null})), renderer: { pixelRatio:view.renderer.getPixelRatio(),smaa:view.smaa.enabled,samples:view.composer.renderTarget1.samples,...view.renderer.info.memory, calls: view.renderer.info.render.calls }, weaponVisual: {turboTrimIntensity:view.tank.turboTrim?.[0]?.emissiveIntensity||0,muzzleFlashVisible:view.muzzleFlash.visible,muzzleFlashAge:view.muzzleFlash.material.uniforms.age.value,source:view.tank.source,turretYaw:view.tank.turret.rotation.y,barrelPitch:view.tank.barrel.rotation.x,recognizerScale:view.recognizers[0].root.scale.x}, breakups:view.breakups.bursts.map(b=>({age:b.age,subject:b.subject,hitPart:b.hitPart,pieces:b.pieces.map(p=>({part:p.part,fragmented:p.fragmented,x:p.group.position.x,y:p.group.position.y,z:p.group.position.z}))})),music:sound.music?{transition:sound.musicTransition?.category||null,category:sound.musicCategory,loop:sound.music.loop,track:sound.musicMode,src:sound.music.currentSrc,gain:sound.musicGain.gain.value,time:sound.music.currentTime,paused:sound.music.paused,ended:sound.music.ended,error:sound.musicError||null}:null,audioSamples:Object.keys(sound.samples),audioSampleErrors:[...sound.sampleErrors],audioNodes:sound.sources.size,terminalSamples:Object.keys(sound.keySamples),terminalClicks:sound.terminalClicks||0,audioState:sound.context?.state,audioOutput:sound.outputLevel(),audioContexts: sound.context ? 1 : 0, audioSources: sound.voices?.length || 0, aerial: view.aerial,aerialZoom:view.aerialZoom }; },
    place(data) { if('yaw' in data||'turretYaw' in data)run.turretHeading=null;Object.assign(run, data); previous = { ...run }; view.reset(); },
    project({x,y,s}) {const p=view.camera.position.clone().set(x,y,-s).project(view.camera);return {x:p.x,y:p.y,z:p.z};},
    configure(values) { Object.assign(config, values); view.resize(); },
    get performance() { const a=[...frameTimes].sort((a,b)=>a-b);return { samples:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)] }; },
    reset: start,
  };
}

function dispose() { disposed = true;jev.dispose(); cancelAnimationFrame(frameId); cleanups.forEach(fn=>fn()); view?.dispose(); sound.dispose(); }
if (import.meta.hot) import.meta.hot.dispose(dispose);
listen(window, 'pagehide', event => { if (!event.persisted) dispose(); else pause(); });

initialize();
