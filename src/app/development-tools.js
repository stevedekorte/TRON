import { config } from '../game/config.js';
import { FLIGHT } from '../simulation/flight.js';
export function createDevelopmentTools({
  session,
  getView,
  sound,
  autoplay,
  jev,
  getMode,
  start,
  frameTimes,
}) {
  return {
    get state() {
      const view = getView(),
        run = session.run,
        mode = getMode();
      return structuredClone({
        ...session.snapshot(),
        autoplay: {
          enabled: autoplay.enabled,
          source: autoplay.tactical?.source,
          plan: autoplay.tactical?.plan,
        },
        aiMode: config.aiMode,
        aiStatus: jev.status,
        aiHistory: jev.history,
        jevStats: jev.stats.value,
        recognizerFlight: { ...FLIGHT },
        mode,
        opening: view.cameraRig.opening,
        carrier: view.carrier?.position.toArray(),
        solarSailer: view.solarSailer ? { visible: view.solarSailer.root.visible && view.solarSailer.ship.visible, position: view.solarSailer.ship.position.toArray() } : null,
        tankVisible: view.tank.root.visible,
        enemyTankVisuals: view.enemyTanks.map((c) => ({
          visible: c.root.visible,
          turretYaw: c.turret.rotation.y,
          barrelPitch: c.barrel.rotation.x,
        })),
        searchlights: view.searchlights.beams.map((b) => ({
          visible: b.mesh.visible,
          length: b.length,
          strength: b.strength,
        })),
        gunnerHit: view.gunnerHit,
        enemyOutlines: view.enemyOutline.enabled,
        arena: view.arena?.position.toArray() ?? null,
        cycleRendering: view.arena?.userData.cycleRace ? {
          tireTraceCount: view.arena.userData.cycleRace.tireTraces.activeCount,
          visible: view.arena.userData.cycleRace.root.visible,
          bikes: view.arena.userData.cycleRace.bikes.map(b=>({visible:b.visible,position:b.getWorldPosition(view.camera.position.clone()).toArray()})),
          trailCounts: view.arena.userData.cycleRace.trails.map(m=>m.count),
        } : null,
        camera: {
          free: view.cameraRig.freeCamera.active,
          beamCinematic: view.cameraRig.beamCinematic,
          aerialBlend: view.cameraRig.aerialBlend,
          rotation: view.camera.quaternion.toArray(),
          gunnerTransition: !!view.cameraRig.gunnerTransition,
          gunnerOpacity: view.cameraRig.gunnerOpacity,
          fov: view.camera.fov,
          x: view.camera.position.x,
          y: view.camera.position.y,
          z: view.camera.position.z,
        },
        maze: session.world.MAZE_KIND,
        carrierBeamVisuals: view.carrierLights.beams.map((b) => ({
          visible: b.mesh.visible,
          length: b.length,
          strength: b.strength,
        })),
        beamVisuals: view.dataBeams.beams.map((b) => ({
          visible: b.visible,
          opacity: b.children[0].material.opacity,
          color: b.children[0].material.color.getHex(),
          curtain: b.userData.effects.curtain.visible,
          waveRadius: b.userData.effects.ring.scale.x,
        })),
        recognizers: run.recognizers.map((e) => ({
          ...e,
          memory: e.memory ? { ...e.memory } : null,
        })),
        renderer: {
          pixelRatio: view.renderer.getPixelRatio(),
          smaa: view.smaa.enabled,
          samples: view.composer.renderTarget1.samples,
          ...view.renderer.info.memory,
          calls: view.renderer.info.render.calls,
        },
        weaponVisual: {
          turboTrimIntensity: view.tank.turboTrim?.[0]?.emissiveIntensity || 0,
          muzzleFlashVisible: view.muzzleFlash.visible,
          muzzleFlashAge: view.muzzleFlash.material.uniforms.age.value,
          source: view.tank.source,
          turretYaw: view.tank.turret.rotation.y,
          barrelPitch: view.tank.barrel.rotation.x,
          recognizerScale: view.recognizers[0].root.scale.x,
        },
        breakups: view.breakups.bursts.map((b) => ({
          age: b.age,
          subject: b.subject,
          hitPart: b.hitPart,
          pieces: b.pieces.map((p) => ({
            part: p.part,
            fragmented: p.fragmented,
            x: p.group.position.x,
            y: p.group.position.y,
            z: p.group.position.z,
          })),
        })),
        music: sound.musicDirector.music
          ? {
              transition: sound.musicDirector.musicTransition?.category || null,
              category: sound.musicDirector.musicCategory,
              loop: sound.musicDirector.music.loop,
              track: sound.musicDirector.musicMode,
              src: sound.musicDirector.music.currentSrc,
              gain: sound.musicDirector.musicGain.gain.value,
              time: sound.musicDirector.music.currentTime,
              paused: sound.musicDirector.music.paused,
              ended: sound.musicDirector.music.ended,
              error: sound.musicDirector.musicError || null,
            }
          : null,
        audioSamples: Object.keys(sound.samples),
        audioSampleErrors: [...sound.sampleErrors],
        audioNodes: sound.sources.size,
        terminalSamples: Object.keys(sound.keySamples),
        terminalClicks: sound.terminalClicks || 0,
        audioState: sound.context?.state,
        audioOutput: sound.outputLevel(),
        audioContexts: sound.context ? 1 : 0,
        audioSources: sound.recognizerVoices?.voices.length || 0,
        aerial: view.cameraRig.aerial,
        aerialZoom: view.cameraRig.aerialZoom,
      });
    },
    place(data) {
      session.place(data);
      getView().reset();
    },
    project({ x, y, s }) {
      const view = getView(),
        p = view.camera.position.clone().set(x, y, -s).project(view.camera);
      return { x: p.x, y: p.y, z: p.z };
    },
    configure(values) {
      Object.assign(config, values);
      session.configure('vehicle', values);
      getView().resize();
    },
    get performance() {
      const a = [...frameTimes].sort((a, b) => a - b);
      return {
        samples: a.length,
        p50: a[Math.floor(a.length * 0.5)],
        p95: a[Math.floor(a.length * 0.95)],
      };
    },
    get diagnostics() {
      return autoplay.diagnostics(session.run);
    },
    reset: start,
  };
}
