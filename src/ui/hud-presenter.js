import {Vector3} from 'three';
import {assistedRecognizerTarget,ASSIST_MARKER} from '../rendering/assist-target.js';
import { config, CLU_HEALTH, CLU_WEAPON, TURBO, GUNNER } from '../game/config.js';
const $ = (id) => document.getElementById(id);
const HEALTH_WARNING = { orange: 0.5, red: 0.25, critical: 0.1 };
export class HudPresenter {
  constructor(world, warnings) {
    this.world = world;
    this.assistPoint=new Vector3();
    this.warnings = warnings;
    this.mapContext = $('map').getContext('2d');
  }
  drawMap(run) {
    const { HALF, BASIS, WALLS } = this.world;
    const ctx = this.mapContext,
      w = 500,
      h = 500,
      scale = 440 / (2 * HALF * (BASIS.a + BASIS.b));
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020710e8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#253e62';
    for (const wall of WALLS) {
      ctx.beginPath();
      wall.points.forEach((p, i) => {
        const x = 250 + p.x * scale,
          y = 250 - p.s * scale;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
    const px = 250 + run.x * scale,
      py = 250 - run.s * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-run.yaw);
    ctx.fillStyle = '#e8ad78';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  update({
    run,
    view,
    mode,
    autoplay,
    jev,
    showSurvey,
    controlsFirstKey,
    idleReminderArmed,
    idleTime,
  }) {
    const cycleMode=run.playerVehicle==='cycle',race=run.cycleRace;
    const marker=$('assist-marker'),rig=view.cameraRig;
    const target=mode==='running'&&!rig.freeCamera.active&&rig.opening==null?assistedRecognizerTarget(run):null;
    const lockId=target?.id??null;
    if(lockId!==this.assistLockId){
      this.assistFlash?.cancel();this.assistFlash=null;this.assistLockId=lockId;
      if(target)this.assistFlash=marker.animate([
        {opacity:ASSIST_MARKER.opacity,offset:0},
        {opacity:ASSIST_MARKER.opacity,offset:.499},
        {opacity:0,offset:.5},{opacity:0,offset:1},
      ],{duration:ASSIST_MARKER.flashPeriodMilliseconds,iterations:ASSIST_MARKER.flashCount});
    }
    marker.hidden=true;
    if(target){
      const camera=view.camera.position;
      this.assistPoint.set(target.x,target.y,-target.s).project(view.camera);
      const p=this.assistPoint;
      if(p.z>=-1&&p.z<=1&&Math.abs(p.x)<1&&Math.abs(p.y)<1&&this.world.lineOfSight({x:camera.x,y:camera.y,s:-camera.z},target)){
        marker.hidden=false;marker.dataset.targetId=String(target.id);
        marker.style.left=`${(p.x+1)*innerWidth/2}px`;marker.style.top=`${(1-p.y)*innerHeight/2}px`;
      }
    }
    document.body.classList.toggle('playing-cycle',cycleMode);
    const cycleControls=$('cycle-controls');cycleControls.hidden=!cycleMode&&!run.arenaWaiting;
    if(run.arenaWaiting)cycleControls.textContent='LOADING CYCLE ARENA...';
    else if(cycleMode){
      const status=race.phase==='countdown'?'LIGHT CYCLES · MATERIALIZING'
        :race.cycles[race.playerId].alive&&race.cycles[race.playerId].escaped?'FREE RIDE · HOLD W/S / SPEED · X / BRAKE / REVERSE · T / TURBO · A/D / STEER · J/L / GLANCE · I/K / ZOOM'
        :!race.cycles[race.playerId].alive?'CYCLE DESTROYED · SPECTATE · RETURN / NEW MATCH'
        :race.phase==='result'?'MATCH COMPLETE · RETURN / NEW MATCH'
        :'LIGHT CYCLES · A/D OR ←/→ TURN · HOLD W/T / TURBO · S/X / SLOW · J/L / GLANCE · I/K / ZOOM · V / AERIAL · ESC / PAUSE';
      cycleControls.textContent=status+(import.meta.env.DEV?' · TAB / DYNAMICS':'');
    }
    $('gunner-sight').hidden =
      !(view.cameraRig.gunnerOpacity > 0) || run.crushed || !['running', 'paused'].includes(mode);
    $('gunner-sight').style.opacity = String(
      (view.cameraRig.gunnerOpacity || 0) * (mode === 'paused' ? 0.35 : 1),
    );
    const point = view.cameraRig.gunScreen,
      scale = Math.min(innerWidth / 1000, innerHeight / 650);
    $('gunner-crosshair').setAttribute(
      'transform',
      point
        ? `translate(${(point.x * innerWidth) / 2 / scale} ${(-point.y * innerHeight) / 2 / scale})`
        : '',
    );
    $('aim-dot').hidden = !view.cameraRig.mouseLook;
    $('mouse-hint').textContent =
      !GUNNER.mouseEnabled || document.pointerLockElement === $('game') ? '' : 'CLICK / MOUSE AIM';
    $('gunner-sight').classList.toggle('on-target', !!view.gunnerHit);
    $('gunner-sight').classList.toggle('critical-target', !!view.gunnerHit?.critical);
    $('gunner-zoom').textContent = ['1×', '2×', '4×', '8×'][run.gunnerZoom];
    $('pitch-hint').textContent=!run.gunner&&!cycleMode?'I/K / ZOOM':'IK / AIM';
    $('zoom-hint').hidden = !(view.cameraRig.aerial || (GUNNER.mouseEnabled && run.gunner));
    $('survey').hidden = !showSurvey;
    $('autoplay-toggle').textContent = autoplay.enabled
      ? `${autoplay.manualFire ? 'SHIFT-U' : 'U'} / AUTOPLAY · ${jev.warning ? 'LOCAL FALLBACK' : autoplay.tactical?.source === 'jev' ? 'JEV' : 'LOCAL'}${autoplay.manualFire ? ' · MANUAL FIRE' : ''}`
      : 'U / AUTOPLAY OFF';
    $('autoplay-toggle').setAttribute('aria-pressed', String(autoplay.enabled));
    const jevStats = jev.stats.value,
      statsNode = $('jev-stats');
    statsNode.children[0].textContent = `N / JEV ${config.aiMode==='jev'?'ON':'OFF'} · ${jevStats.requests} REQUESTS · ${jevStats.requestsPerSecond.toFixed(1)}/s`;
    statsNode.children[1].textContent = `${jevStats.estimatedRequests ? '~' : ''}$${jevStats.costUsd.toFixed(5)} USD`;

    this.warnings.set(
      'jev',
        (config.aiMode === 'jev' || autoplay.enabled
          ? jev.warning
          : {
              level: 'warning',
              label: 'JEV OFF',
              detail:
                config.aiMode === 'classic'
                  ? 'Classic enemy AI selected.'
                  : 'Local tactical AI selected.',
            }),
    );
    const roadHealthBike=cycleMode&&race.cycles[race.playerId].escaped?race.cycles[race.playerId]:null;
    document.body.classList.toggle('cycle-road',!!roadHealthBike);
    const healthFraction = roadHealthBike ? (roadHealthBike.roadHealth??1) : run.crushed ? 0 : Math.max(0, Math.min(1, run.health / CLU_HEALTH.max)),
      healthPercent = Math.ceil(healthFraction * 100);
    $('health-fill').style.transform = `scaleX(${healthFraction})`;
    $('health-meter').setAttribute('aria-valuenow', String(healthPercent));
    $('clu-health').dataset.level =
      healthFraction <= HEALTH_WARNING.critical
        ? 'critical'
        : healthFraction <= HEALTH_WARNING.red
          ? 'red'
          : healthFraction <= HEALTH_WARNING.orange
            ? 'orange'
            : 'normal';
    const shotsMeter = $('shots-meter');
    const storedShots = run.crushed ? 0 : run.extraShots;
    shotsMeter.setAttribute('aria-valuenow', String(storedShots));
    for (let i = 0; i < shotsMeter.children.length; i++) {
      const charge = i < storedShots ? 1 : !run.crushed && i === storedShots ? Math.min(1, run.shotRest / CLU_WEAPON.reserveRecharge) : 0;
      shotsMeter.children[i].style.setProperty('--charge', String(charge));
      shotsMeter.children[i].classList.toggle('ready', i < storedShots);
    }
    const roadBike=cycleMode&&race.cycles[race.playerId].escaped?race.cycles[race.playerId]:null;
    const turbo = $('turbo'),
      boosting = cycleMode ? race.cycles[race.playerId].boosting : run.turboRemaining > 0,
      charging = cycleMode ? race.cycles[race.playerId].turboCharge < 1 : run.turboCooldown > 0;
    turbo.querySelector('span').textContent = roadBike ? `T / TURBO · ${roadBike.reverseGear?'R':Math.round(roadBike.targetRoadSpeed*3.6)+' SET'} · ${Math.round(Math.abs(roadBike.roadSpeed)*3.6)} KM/H` : cycleMode ? 'W/T / TURBO' : 'T / TURBO';
    turbo.setAttribute(
      'aria-label',
      boosting ? 'Turbo active' : charging ? 'Turbo recharging' : 'Turbo ready',
    );
    turbo.classList.toggle('boosting', boosting);
    turbo.classList.toggle('charging', charging);
    $('turbo-fill').style.transform =
      `scaleX(${cycleMode ? race.cycles[race.playerId].turboCharge : boosting ? run.turboRemaining / TURBO.duration : 1 - run.turboCooldown / TURBO.rechargeSeconds})`;
    const openingControls = controlsFirstKey === null || run.time - controlsFirstKey < 10;
    $('hint').classList.toggle(
      'faded',
      mode !== 'running' ||
        !(openingControls || (idleReminderArmed && idleTime >= 3)),
    );
    document.body.classList.toggle('impact', run.impact > 0.6 && !view.cameraRig.reducedMotion);
    if (showSurvey) this.drawMap(run);
    if (import.meta.env.DEV && !$('tuning').hidden) {
      $('ai-status').textContent = jev.status;
      $('ai-decision').textContent = JSON.stringify(
        jev.history.at(-1) || {
          mode: config.aiMode,
          units: [...run.recognizers, ...run.enemyTanks].map((e) => ({
            id: e.id,
            maneuver: e.tactical?.plan?.kind,
            source: e.tactical?.source,
            blocked: e.tactical?.blocked,
          })),
        },
        null,
        2,
      );
      $('perception').textContent = run.recognizers
        .map(
          (e) =>
            `R${e.id + 1} ${e.state} | ${e.canSee ? 'visual' : e.memory ? `last seen ${(run.time - e.memory.seenAt).toFixed(1)}s ago via R${e.memory.source + 1}` : 'no sighting'}`,
        )
        .join('\n');
    }
  }
}
