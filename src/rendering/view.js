import {TANK} from '../game/tank.js';
import {RECOGNIZER_STARTS} from '../game/recognizer-roster.js';
import {updateMouseTarget} from './mouse-target.js';
import {cannonPose} from '../simulation/run.js';
import {GROUND_TANK_COUNT} from '../simulation/ground-tanks.js';
import {Searchlights} from './searchlights.js';
import {updateCarrier} from './carrier.js';
import {Breakups} from './breakup.js';
import {createMuzzleFlash} from './muzzle-flash.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createWorld } from './world.js';
import { createRecognizer,cloneEnemyTank } from './models.js';
import { config, GUNNER, RECOGNIZER_SCALE, angleDelta, gunnerAimScale } from '../game/config.js';
import { wallIntersection, lineOfSight } from '../levels/maze.js';

const AERIAL_CAMERA=Object.freeze({transitionSeconds:1.2,height:600,distance:Math.hypot(180,320)});
const GUNNER_TRANSITION_SECONDS=.75;
const TURBO_GLOW=Object.freeze({base:1.8,pulse:1.2,hz:2,response:10});
const IMPACT_SHAKE=Object.freeze({pitch:.012,yaw:.009,roll:.006});

const GUNNER_ZOOM_SECONDS=.35;
export class View {
  moveMouseAim(dx,dy,run){
    if(!this.mouseLook)this.mouseLook={yaw:run.yaw+run.turretYaw,pitch:run.aimPitch};
    const sensitivity=.0025*gunnerAimScale(run.gunnerZoom);
    this.mouseLook.yaw-=dx*sensitivity;
    this.mouseLook.pitch=THREE.MathUtils.clamp(this.mouseLook.pitch-dy*sensitivity,GUNNER.minPitch,GUNNER.maxPitch);
  }
  constructor(canvas, tank, recognizer, carrier=null) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.24;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050c);
    this.scene.fog = new THREE.FogExp2(0x090d1d, config.fog);
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, 0.15, 2500);
    this.scene.add(new THREE.HemisphereLight(0xaac8ff, 0x251829, 2));
    const key = new THREE.DirectionalLight(0xc4d9ff, 2.4); key.position.set(-35, 70, -35); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x7b72ab, 0.9); fill.position.set(50, 15, -40); this.scene.add(fill);
    this.world = createWorld(this.scene);
    this.carrier=carrier;if(carrier)this.scene.add(carrier);
    this.tank = tank; this.scene.add(this.tank.root);
    this.muzzleFlash=createMuzzleFlash();this.scene.add(this.muzzleFlash);
    this.enemyTanks=Array.from({length:GROUND_TANK_COUNT},()=>{const craft=cloneEnemyTank(tank);this.scene.add(craft.root);return craft;});
    this.recognizers = RECOGNIZER_STARTS.map(() => { const craft=createRecognizer(recognizer); craft.root.scale.setScalar(RECOGNIZER_SCALE); this.scene.add(craft.root); return craft; });
    recognizer.traverse(o => o.material?.dispose());
    this.breakups=new Breakups(this.scene);
    this.searchlights=new Searchlights(this.scene,this.recognizers.length);
    this.aerial = false;this.aerialZoom=1;this.aerialBlend=0;
    this.shots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd2a3).multiplyScalar(4) }), 80);
    this.shots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shots.frustumCulled = false; this.shots.count = 0; this.scene.add(this.shots);
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf67556).multiplyScalar(1.6) }), 140);
    this.debris.frustumCulled = false; this.debris.count = 0; this.scene.add(this.debris); this.particles = [];
    this.matrixObject = new THREE.Object3D();
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), config.bloom, 0.5, 0.85); this.composer.addPass(this.bloom);
    this.output = new OutputPass(); this.composer.addPass(this.output);
    this.film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float n=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;
      float vignette=1.-.36*pow(length((vUv-.5)*1.35),2.); gl_FragColor=vec4(c*vignette+n*.016,1.);}`,
    }); this.composer.addPass(this.film);
    this.followPosition=new THREE.Vector3();
    this.look = new THREE.Vector3(); this.desired = new THREE.Vector3(); this.lookDesired = new THREE.Vector3(); this.projected = new THREE.Vector3();
    this.elapsed = 0; this.reducedMotion = false; this.lowQuality = false; this.freshCamera = true;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w * config.renderScale, h * config.renderScale, false);
    this.composer.setSize(w * config.renderScale, h * config.renderScale);
  }

  reset() { this.damageSparkTimes=new Map(); this.zoomTransition=null;this.zoomFov=undefined;this.zoomTarget=undefined; this.gunnerTransition=null;this.wasGunner=false;this.gunnerOpacity=0;this.aerialBlend=0;this.searchlights.reset();this.breakups.clear();this.encounterFocus=0;this.encounterPitch=undefined;this.freshCamera = true; this.particles.length = 0; }

  event(event) {
    if (!['hit', 'destroyed'].includes(event.type)) return;
    if(event.type==='destroyed'&&event.subject==='tank'){this.tank.turret.rotation.y=event.turretYaw;this.breakups.spawn(this.tank,event);return;}
    if(event.type==='destroyed'&&event.subject==='enemyTank'){const craft=this.enemyTanks[event.id-100];if(craft){craft.turret.rotation.y=event.turretYaw;this.breakups.spawn(craft,event);}return;}
    if(event.type==='destroyed'&&this.recognizers[event.id]){this.breakups.spawn(this.recognizers[event.id],event);return;}
    const count = event.type === 'destroyed' ? 80 : 12;
    for (let i = 0; i < count && this.particles.length < 140; i++) {
      this.particles.push({ x: event.x, y: event.y, z: -event.s,
        vx: Math.sin(i * 5.7) * (event.type === 'destroyed' ? 20 : 8), vy: 5 + (i % 9) * 1.8,
        vz: Math.cos(i * 8.3) * 18, age: 0, life: 1 + (i % 7) * 0.23, scale: event.type === 'destroyed' ? 0.8 + i % 4 * 0.5 : 0.25 });
    }
  }

  render(run, previous, alpha, dt, mode, rear = false) {
    this.elapsed += dt;
    const aerialTarget=this.aerial?1:0;
    if(this.reducedMotion)this.aerialBlend=aerialTarget;
    else this.aerialBlend+=THREE.MathUtils.clamp(aerialTarget-this.aerialBlend,-dt/AERIAL_CAMERA.transitionSeconds,dt/AERIAL_CAMERA.transitionSeconds);
    const aerialMix=THREE.MathUtils.smoothstep(this.aerialBlend,0,1);
    const preview = mode === 'ready',gunner=run.gunner&&!run.crushed&&!preview&&this.opening==null;
    if(gunner!==!!this.wasGunner){
      this.gunnerTransition=!this.reducedMotion&&!preview&&!run.crushed?{
        position:this.camera.position.clone(),rotation:this.camera.quaternion.clone(),fov:this.camera.fov,
        x:run.x,s:run.s,opacity:this.gunnerOpacity||0,elapsed:0
      }:null;
      this.wasGunner=gunner;
    }
    if(preview||run.crushed||this.reducedMotion)this.gunnerTransition=null;

    if(this.carrier){this.carrier.visible=!preview;updateCarrier(this.carrier,run.time);}
    const x = previous.x + (run.x - previous.x) * alpha;
    const s = previous.s + (run.s - previous.s) * alpha;
    const yaw = previous.yaw + angleDelta(previous.yaw, run.yaw) * alpha;
    this.tank.root.position.set(x, 0, -s);
    this.tank.root.visible=!run.crushed&&!gunner;this.tank.root.scale.y=1;
    this.tank.root.rotation.set(0, yaw, 0);
    this.tank.turret.rotation.y = previous.turretYaw + angleDelta(previous.turretYaw, run.turretYaw) * alpha;
    this.tank.barrel.rotation.x = 0;
    this.tank.barrel.position.z = run.recoil * 0.35;
    this.tank.flash.visible = false;
    const turboTarget=run.turboRemaining>0&&!run.crushed?1:0;
    this.turboGlow=THREE.MathUtils.damp(this.turboGlow||0,turboTarget,TURBO_GLOW.response,mode==='paused'?0:dt);
    const pulse=this.reducedMotion ? .5 : (.5+.5*Math.sin(run.time*Math.PI*2*TURBO_GLOW.hz));
    for(const material of this.tank.turboTrim||[]){material.emissive.setHex(0xff0301);material.emissiveIntensity=this.turboGlow*(TURBO_GLOW.base+TURBO_GLOW.pulse*pulse);}

    this.tank.tracks.forEach((t, i) => { t.material = this.tank.tracks[0].material; t.visible = (Math.floor(run.s * 3) + i) % 3 !== 0; });

    this.world.floor.position.set(x,-.06,-s);
    this.world.floor.scale.setScalar(aerialMix>0?Math.max(1,this.aerialZoom):1);
    run.recognizers.forEach((e,i)=>{
      const craft=this.recognizers[i];craft.root.visible=e.state!=='destroyed';
      craft.root.position.set(e.x,e.y,-e.s);craft.root.rotation.set(0,e.yaw,0);
      craft.pose(e.fold||0);
      craft.material.emissive.setRGB(e.hit*.65,e.hit*.16,e.hit*.08);
    });
    run.enemyTanks.forEach((e,i)=>{const craft=this.enemyTanks[i];craft.root.visible=!preview&&e.state!=='destroyed';craft.root.position.set(e.x,0,-e.s);craft.root.rotation.set(0,e.yaw,0);craft.turret.rotation.y=e.turretYaw;craft.barrel.position.z=e.recoil*.35;craft.flash.visible=e.recoil>.75;});
    this.shots.count = Math.min(80, run.projectiles.length);
    run.projectiles.slice(0, 80).forEach((p, i) => {
      this.matrixObject.position.set(p.x, p.y, -p.s); this.matrixObject.rotation.set(0, 0, 0);
      this.matrixObject.scale.set(1, 1, 3); this.matrixObject.lookAt(p.x + p.vx, p.y + p.vy, -p.s - p.vs);
      this.matrixObject.updateMatrix(); this.shots.setMatrixAt(i, this.matrixObject.matrix);
    }); this.shots.instanceMatrix.needsUpdate = true;
    const particleDt = mode === 'paused' ? 0 : dt;
    this.damageSparkTimes??=new Map();
    if(particleDt>0&&!preview)for(const enemy of [...run.recognizers,...run.enemyTanks]){
      if(enemy.state==='destroyed')continue;
      const tick=Math.floor(run.time*4);
      if(this.damageSparkTimes.get(enemy.id)===tick)continue;
      this.damageSparkTimes.set(enemy.id,tick);
      for(const [part,hits] of Object.entries(enemy.partHits||{})){
        if(!(part.endsWith('-track')&&hits>=1||part.endsWith('-leg')&&hits>=2))continue;
        const ground=enemy.kind==='ground',side=part.startsWith('left')?-1:1;
        const localX=side*(ground?3:(14-(enemy.fold||0)*13)*RECOGNIZER_SCALE);
        for(let i=0;i<2&&this.particles.length<140;i++)this.particles.push({
          x:enemy.x+Math.cos(enemy.yaw)*localX,y:ground?1:enemy.y-12*RECOGNIZER_SCALE,z:-enemy.s-Math.sin(enemy.yaw)*localX,
          vx:Math.sin(tick*2.3+i)*2,vy:1.5+i,vz:Math.cos(tick*3.1+i)*2,age:0,life:.45+i*.1,scale:.12});
      }
    }

    if(particleDt>0)this.breakups.update(particleDt);
    this.particles = this.particles.filter(p => p.age < p.life);
    this.debris.count = this.particles.length;
    this.particles.forEach((p, i) => {
      p.age += particleDt; p.x += p.vx * particleDt; p.y += p.vy * particleDt; p.z += p.vz * particleDt; p.vy -= particleDt * 14;
      this.matrixObject.position.set(p.x, Math.max(0.1, p.y), p.z); this.matrixObject.rotation.set(p.age * 3, i + p.age, p.age * 2);
      this.matrixObject.scale.setScalar(p.scale * Math.max(0.02, 1 - p.age / p.life)); this.matrixObject.updateMatrix(); this.debris.setMatrixAt(i, this.matrixObject.matrix);
    }); this.debris.instanceMatrix.needsUpdate = true;

    let overhead=null;
    const cameraYaw=yaw+this.tank.turret.rotation.y+(rear?Math.PI:0);
    if(!preview&&aerialMix===0&&this.opening==null&&!this.referenceCamera) {
      const fragments=this.breakups.bursts.filter(b=>b.age<3).map(b=>{
        const center=new THREE.Vector3();for(const p of b.pieces)center.add(p.group.position);center.multiplyScalar(1/b.pieces.length);
        return {x:center.x,s:-center.z,y:center.y,state:'debris'};
      });
      for(const e of [...run.recognizers,...fragments]) {
        if(e.state==='destroyed')continue;
        const dx=e.x-x,dz=-e.s+s,distance=Math.hypot(dx,dz);
        const ahead=-Math.sin(cameraYaw)*dx-Math.cos(cameraYaw)*dz;
        const side=Math.abs(Math.cos(cameraYaw)*dx-Math.sin(cameraYaw)*dz);
        if(distance>110||ahead< -8||side>30+Math.max(0,ahead)*.7)continue;
        if(!lineOfSight({x,s,y:config.cameraHeight},{x:e.x,s:e.s,y:e.y}))continue;
        if(!overhead||distance<overhead.distance)overhead={e,distance};
      }
    }
    const focus=overhead?1-THREE.MathUtils.smoothstep(overhead.distance,25,110):0;
    this.encounterFocus=THREE.MathUtils.lerp(this.encounterFocus||0,focus,1-Math.exp(-dt*2));
    if (preview) {
      this.desired.set(x + 15, 9, -s + 22);
      this.lookDesired.set(x - 5, 5, -s - 22);
    } else {
      // A little extra distance makes room for both the tank and an overhead
      // craft; tilting alone would put Clu below the bottom of the frame.
      const distance=config.cameraDistance+32*this.encounterFocus;
      this.desired.set(x + Math.sin(cameraYaw) * distance, config.cameraHeight, -s + Math.cos(cameraYaw) * distance);
      this.lookDesired.set(x - Math.sin(cameraYaw) * 30, 5.1, -s - Math.cos(cameraYaw) * 30);
    }
    if(!preview&&this.opening==null&&!this.referenceCamera){
      // Clip the driving endpoint before blending so descent stays continuous near walls.
      const anchor={x,s,y:3.5},end={x:this.desired.x,s:-this.desired.z,y:this.desired.y};
      const hit=wallIntersection(anchor,end,1.2);
      if(hit!==null){const t=Math.max(.05,hit-.06);this.desired.set(x+(end.x-x)*t,3.5+(end.y-3.5)*t,-s-(end.s-s)*t);}
      const distance=AERIAL_CAMERA.distance*this.aerialZoom;
      this.desired.lerp(new THREE.Vector3(x+Math.sin(cameraYaw)*distance,AERIAL_CAMERA.height*this.aerialZoom,-s+Math.cos(cameraYaw)*distance),aerialMix);
      this.lookDesired.lerp(new THREE.Vector3(x,0,-s),aerialMix);
    }
    const blend = this.freshCamera ? 1 : 1 - Math.exp(-dt * (this.reducedMotion ? 13 : config.cameraLag));
    // Keep chase smoothing independent of the displayed gunner/transition camera.
    // Feeding the blended position back here made exit pitch corrections oscillate.
    this.followPosition.lerp(this.desired,blend);
    this.camera.position.copy(this.followPosition);this.look.lerp(this.lookDesired,blend);
    if (!preview && aerialMix===0) {
      const anchor={x,s,y:3.5},end={x:this.camera.position.x,s:-this.camera.position.z,y:this.camera.position.y};
      const collision=wallIntersection(anchor,end,1.2);
      if(collision!==null) {
        const t=Math.max(.05,collision-.06);
        this.camera.position.set(x+(end.x-x)*t,3.5+(end.y-3.5)*t,-s-(end.s-s)*t);
      }
    }
    if(this.opening!=null) {
      const t=THREE.MathUtils.smoothstep(this.opening,.15,1);
      const height=Math.exp(THREE.MathUtils.lerp(Math.log(320),Math.log(config.cameraHeight),t));
      const distance=THREE.MathUtils.lerp(500,config.cameraDistance,t);
      this.camera.position.set(x+Math.sin(cameraYaw)*distance+70*(1-t),height,-s+Math.cos(cameraYaw)*distance);
      this.look.set(x-Math.sin(cameraYaw)*30*t,5.1*t,-s-Math.cos(cameraYaw)*30*t);
    }
    if (this.referenceCamera) { this.camera.position.copy(this.referenceCamera.position); this.look.copy(this.referenceCamera.target); }
    const encounterFov=config.fov+8*this.encounterFocus;
    if(!preview&&aerialMix===0&&this.opening==null&&!this.referenceCamera) {
      const basePitch=Math.atan2(this.look.y-this.camera.position.y,Math.hypot(this.look.x-this.camera.position.x,this.look.z-this.camera.position.z));
      const tankPitch=Math.atan2(2-this.camera.position.y,Math.hypot(x-this.camera.position.x,-s-this.camera.position.z));
      const craftPitch=overhead?Math.atan2(overhead.e.y-this.camera.position.y,Math.hypot(overhead.e.x-this.camera.position.x,-overhead.e.s-this.camera.position.z)):basePitch;
      const targetPitch=overhead?Math.max(basePitch,(tankPitch+craftPitch)*.5):basePitch;
      this.encounterPitch=THREE.MathUtils.lerp(this.encounterPitch??basePitch,targetPitch,1-Math.exp(-dt*2));
      // Clamp against the tank's top, including after camera/wall collision.
      const pitch=Math.min(this.encounterPitch,tankPitch+THREE.MathUtils.degToRad(encounterFov*.5-5));
      const length=Math.hypot(this.look.x-this.camera.position.x,this.look.z-this.camera.position.z);
      this.camera.lookAt(this.look.x,this.camera.position.y+Math.tan(pitch)*length,this.look.z);
    } else this.camera.lookAt(this.look);
    this.followPosition.copy(this.camera.position);
    this.freshCamera = false;
    if(gunner){
      // Anchor the sight at the turret pivot, not the muzzle: motor correction
      // must not orbit the camera or feed changing parallax back into mouse aim.
      const pose={x:x+Math.cos(yaw)*TANK.pivot[0]+Math.sin(yaw)*TANK.pivot[2],
        s:s+Math.sin(yaw)*TANK.pivot[0]-Math.cos(yaw)*TANK.pivot[2],
        y:TANK.muzzle[1],yaw:yaw+this.tank.turret.rotation.y};
      const pitch=(previous.aimPitch??run.aimPitch)+(run.aimPitch-(previous.aimPitch??run.aimPitch))*alpha;
      const obstruction=wallIntersection({x,s,y:pose.y},pose,.2);
      if(obstruction!==null){const t=Math.max(0,obstruction-.02);pose.x=x+(pose.x-x)*t;pose.s=s+(pose.s-s)*t;}
      this.camera.position.set(pose.x,pose.y,-pose.s);
      const aim=this.mouseLook||{yaw:pose.yaw,pitch};
      this.camera.lookAt(pose.x-Math.sin(aim.yaw)*Math.cos(aim.pitch)*100,pose.y+Math.sin(aim.pitch)*100,-pose.s-Math.cos(aim.yaw)*Math.cos(aim.pitch)*100);
    }
    const zoomTarget=GUNNER.fovs[run.gunnerZoom];
    if(!gunner||this.reducedMotion||this.zoomFov==null){
      this.zoomFov=zoomTarget;this.zoomTarget=zoomTarget;this.zoomTransition=null;
    }else if(zoomTarget!==this.zoomTarget){
      this.zoomTransition={from:this.zoomFov,elapsed:0};this.zoomTarget=zoomTarget;
    }
    if(this.zoomTransition){
      this.zoomTransition.elapsed+=dt;
      const t=THREE.MathUtils.smootherstep(Math.min(1,this.zoomTransition.elapsed/GUNNER_ZOOM_SECONDS),0,1);
      this.zoomFov=THREE.MathUtils.lerp(this.zoomTransition.from,zoomTarget,t);
      if(t===1)this.zoomTransition=null;
    }
    this.camera.far=12000;
    this.camera.fov = gunner?this.zoomFov:this.referenceCamera?.fov ?? (this.aerial||preview||this.opening!=null?config.fov:encounterFov);
    this.gunnerOpacity=gunner?1:0;
    if(this.gunnerTransition){
      const transition=this.gunnerTransition;
      transition.elapsed+=dt;
      const t=THREE.MathUtils.smootherstep(Math.min(1,transition.elapsed/GUNNER_TRANSITION_SECONDS),0,1);
      const origin=transition.position.clone().add(new THREE.Vector3(x-transition.x,0,-s+transition.s));
      this.camera.position.lerpVectors(origin,this.camera.position,t);
      this.camera.quaternion.slerpQuaternions(transition.rotation,this.camera.quaternion.clone(),t);
      this.camera.fov=THREE.MathUtils.lerp(transition.fov,this.camera.fov,t);
      this.gunnerOpacity=THREE.MathUtils.lerp(transition.opacity,gunner?1:0,t);
      // Hide the exterior model only as the camera enters its volume.
      this.tank.root.visible=!run.crushed&&(Math.hypot(this.camera.position.x-x,this.camera.position.z+s)>7||this.camera.position.y>5);
      if(t===1){this.gunnerTransition=null;if(gunner)this.tank.root.visible=false;}
    }
    this.camera.updateProjectionMatrix();
    // Apply only to the final camera orientation: no drift in follow smoothing or aim.
    // Simulation time freezes the vibration on pause; impact decays in ~0.4 seconds.
    if(!preview&&!this.referenceCamera&&!this.reducedMotion){
      const strength=run.impact**1.5*Math.tan(this.camera.fov*Math.PI/360)/Math.tan(config.fov*Math.PI/360);
      const t=run.time;
      this.camera.rotateX(strength*IMPACT_SHAKE.pitch*(Math.sin(t*83)+.35*Math.sin(t*139)));
      this.camera.rotateY(strength*IMPACT_SHAKE.yaw*(Math.sin(t*109)+.3*Math.cos(t*173)));
      this.camera.rotateZ(strength*IMPACT_SHAKE.roll*Math.sin(t*97));
    }
    this.gunScreen=null;
    if(gunner&&this.mouseLook){
      this.camera.updateMatrixWorld();
      const heading=yaw+this.tank.turret.rotation.y;
      const pitch=(previous.aimPitch??run.aimPitch)+(run.aimPitch-(previous.aimPitch??run.aimPitch))*alpha;
      const d=new THREE.Vector3(-Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),-Math.cos(heading)*Math.cos(pitch));
      this.gunScreen=d.multiplyScalar(1000).add(this.camera.position).project(this.camera);
      updateMouseTarget.call(this,run);
    }
    this.scene.fog.density = config.fog * (this.referenceCamera?.fogScale ?? (this.opening!=null?THREE.MathUtils.lerp(.06,1,this.opening):THREE.MathUtils.lerp(1,.06,aerialMix)));
    this.world.aerialView.value=this.opening!=null?1-this.opening:(!this.referenceCamera?aerialMix:0);
    this.bloom.strength = config.bloom; this.bloom.enabled = !this.lowQuality;
    this.film.enabled = !this.lowQuality; this.film.uniforms.time.value = this.elapsed;
    this.searchlights.update(run.recognizers,run.time,this.camera,mode==='paused'?0:dt,!preview);
    const muzzleAge=(1-run.recoil)/4;
    this.muzzleFlash.visible=!gunner&&!this.gunnerTransition&&!run.crushed&&!preview&&muzzleAge<.17;
    if(this.muzzleFlash.visible){
      this.muzzleFlash.material.uniforms.age.value=muzzleAge;
      this.muzzleFlash.material.uniforms.seed.value=run.shots*2.399;
      this.tank.root.updateMatrixWorld(true);
      this.tank.flash.getWorldPosition(this.muzzleFlash.position);
      this.muzzleFlash.quaternion.copy(this.camera.quaternion);
      this.muzzleFlash.scale.setScalar(1);
    }
    for(const burst of this.breakups.bursts)burst.optical?.mesh.quaternion.copy(this.camera.quaternion);
    this.renderer.info.reset(); this.composer.render(dt);
  }

  dispose() {
    this.breakups.clear();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    for (const pass of this.composer.passes) pass.dispose?.();
    this.composer.dispose(); this.renderer.dispose();
  }
}
