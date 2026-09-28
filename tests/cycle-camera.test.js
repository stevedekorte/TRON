import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {cyclePlayerPose} from '../src/simulation/light-cycles.js';

function setup(){
 const bike={id:0,alive:true,previousX:0,x:0,previousZ:0,z:-1,progress:0,dir:0};
 const run={playerVehicle:'cycle',cycleRace:{phase:'racing',playerId:0,site:{x:1700,s:2400},cycles:[bike]}};
 return {bike,run,rig:new CameraRig({})};
}
function frame(rig,run,dt){
 rig.update(run,run,0,dt,'running',{});
 rig.camera.updateMatrixWorld();
 const pose=cyclePlayerPose(run.cycleRace);
 return new Vector3(pose.x,.8,-pose.s).project(rig.camera);
}
test('cycle stays at a stable screen height across fixed steps, duplicate frames and turbo',()=>{
 const {bike,run,rig}=setup(),initial=frame(rig,run,1/60);
 // Render cadence does not always coincide with a new simulation position.
 for(let i=0;i<360;i++){
  if(i%3!==0){bike.progress+=i<180?8/60:20/60;
   if(bike.progress>=1){bike.progress-=1;bike.previousZ--;bike.z--;}}
  const screen=frame(rig,run,[1/144,1/60,1/30][i%3]);
  assert(Math.abs(screen.y-initial.y)<1e-9,`vertical bob at frame ${i}`);
  assert(Math.abs(screen.x-initial.x)<1e-9);
 }
});
test('cycle turns ease the orbit; reset removes the previous match anchor',()=>{
 const {bike,run,rig}=setup();frame(rig,run,1/60);
 bike.dir=1;const pose=cyclePlayerPose(run.cycleRace);
 frame(rig,run,1/60);
 assert(rig.camera.position.x<pose.x&&rig.camera.position.x>pose.x-10);
 for(let i=0;i<180;i++)frame(rig,run,1/60);
 assert(Math.abs(rig.camera.position.x-(pose.x-10))<1e-8);
 rig.reset();assert.equal(rig.cycleAnchor,null);
 bike.x=100;bike.previousX=99;frame(rig,run,1/60);
 assert(Math.abs(rig.camera.position.x-(cyclePlayerPose(run.cycleRace).x-10))<1e-9);
});
test('held J/L glance smoothly toward the rear quarter and release returns forward',()=>{
 for(const direction of [-1,1]){
  const {run,rig}=setup();frame(rig,run,1/60);const position=rig.camera.position.clone();
  rig.cycleGlanceInput=direction;frame(rig,run,1/60);
  assert(rig.cycleGlance*direction<0);assert(Math.abs(rig.cycleGlance)<Math.PI*2/3);
  for(let i=0;i<30;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleGlance)>Math.PI*.65);
  assert(rig.camera.position.distanceTo(position)>5);
  rig.cycleGlanceInput=0;for(let i=0;i<40;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleGlance)<.001);
 }
});
test('side glances keep the horizon level',()=>{
 const {run,rig}=setup();rig.cycleGlanceInput=1;
 for(let i=0;i<30;i++){
  frame(rig,run,1/120);
  const right=new Vector3(1,0,0).applyQuaternion(rig.camera.quaternion);
  assert(Math.abs(right.y)<1e-9);
 }
});
test('cycle render interpolation shares movement with trails without cutting corners',async()=>{
 const {interpolateCycleRace}=await import('../src/rendering/cycle-poses.js');
 const b={alive:true,dir:1,previousX:1,x:2,previousZ:0,z:0,progress:.1,renderTravel:.2,renderPrevious:{x:1,z:.1,dir:0}};
 const race={phase:'racing',cycles:[b]};
 const first=interpolateCycleRace(race,.25).cycles[0];
 assert.equal(first.x,1);assert(Math.abs(first.z-.05)<1e-9);
 const second=interpolateCycleRace(race,.75).cycles[0];
 assert(Math.abs(second.x-1.05)<1e-9);assert.equal(second.z,0);
 assert(Math.abs(second.progress-.05)<1e-9);assert.equal(b.progress,.1);
});

test('orbit glances keep the cycle visible and are slower outside the arena',()=>{
 const arena=setup(),road=setup();road.bike.escaped=true;road.bike.yaw=0;
 for(const s of [arena,road]){frame(s.rig,s.run,1/60);s.rig.cycleGlanceInput=1;}
 for(let i=0;i<12;i++)for(const s of [arena,road]){const p=frame(s.rig,s.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
 assert(Math.abs(road.rig.cycleGlance)<Math.abs(arena.rig.cycleGlance)*.65);
 for(let i=0;i<120;i++){const p=frame(road.rig,road.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
 road.rig.cycleGlanceInput=0;
 for(let i=0;i<120;i++){const p=frame(road.rig,road.run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);}
});

test('road camera anticipates steering while keeping the bike visible and horizon level',()=>{
 for(const sign of [-1,1]){
  const {bike,run,rig}=setup();Object.assign(bike,{escaped:true,yaw:0,roadSpeed:30,steering:sign});
  for(let i=0;i<90;i++){
   const p=frame(rig,run,1/60);assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.8);
   assert(Math.abs(new Vector3(1,0,0).applyQuaternion(rig.camera.quaternion).y)<1e-9);
  }
  assert(rig.cycleTurnLook*sign<-.5);assert((rig.look.x-cyclePlayerPose(run.cycleRace).x)*sign>3);
  bike.steering=0;for(let i=0;i<120;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleTurnLook)<.001);
  bike.steering=sign;bike.roadSpeed=0;for(let i=0;i<120;i++)frame(rig,run,1/60);
  assert(Math.abs(rig.cycleTurnLook)<.001);
  rig.reset();assert.equal(rig.cycleTurnLook,0);
 }
});

test('cycle aerial view shares Clu height, offset and zoom instead of a separate close overhead view',()=>{
 const {run,rig}=setup();rig.aerial=true;rig.aerialZoom=2;rig.frame={aerialMix:1};
 frame(rig,run,1/60);const pose=cyclePlayerPose(run.cycleRace);
 assert.equal(rig.camera.position.y,1200);
 assert(Math.abs(Math.hypot(rig.camera.position.x-pose.x,rig.camera.position.z+pose.s)-Math.hypot(180,320)*2)<1e-6);
 assert(rig.look.distanceTo(new Vector3(pose.x,0,-pose.s))<1e-6);
});

test('16-second film entrance descends, pans right and down, then accelerates across the grid',async()=>{
 const {applyCycleOpening,CYCLE_OPENING}=await import('../src/rendering/cycle-opening.js');
 const site={x:1400,s:2600};
 const sample=seconds=>{const p=new Vector3(),look=new Vector3();const roll=applyCycleOpening(seconds/16,site,p,look);return {p,d:look.sub(p).normalize(),roll};};
 for(let i=0;i<=1000;i++){
  const {p,roll}=sample(i*16/1000);
  if(p.x-site.x<=-409&&p.x-site.x>=-466)assert(p.y>65,'clear the actual 60 m wall crest with margin');
  assert(p.y>=4);assert.equal(roll,0);
 }
 const before=sample(5),down=sample(10.5),arrival=sample(16);
 assert(before.d.x<-.9,'initially face the maze');
 assert(down.d.y<-.9,'look steeply down at the grid before accelerating');
 assert(down.d.z<0&&Math.abs(down.d.x)<.1,'pan right toward the far end');
 assert(sample(12).p.distanceTo(sample(14).p)>sample(7).p.distanceTo(sample(9).p)*2,'rapid floor traverse follows slow descent');
 for(let t=7;t<12;t+=.05)assert(sample(t+.05).p.distanceTo(sample(t).p)/.05>35,'keep moving through the downward turn');
 assert.deepEqual(arrival.p.toArray(),[1400,4,-2970]);
 assert(Math.abs(arrival.d.y)<1e-6);
 assert.equal(CYCLE_OPENING.durationSeconds,16);assert.equal(CYCLE_OPENING.raceReleaseFraction,1);
});

test('entrance audio pauses and resumes inside a cue without duplicate voices',async()=>{
 const {CycleOpeningAudio}=await import('../src/audio/cycle-opening.js');
 const sources=[];
 const context={createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createBufferSource:()=>{
  const source={connect(){},disconnect(){},start(when,offset){this.offset=offset;},stop(){this.stopped=true;}};sources.push(source);return source;
 }};
 const audio=new CycleOpeningAudio(context,{}, {'cycle-prepare-transport':{duration:2.56}});
 audio.update(10,true);assert.equal(sources.length,1);assert(Math.abs(sources[0].offset-.7)<1e-8);
 audio.update(10.1,true);assert.equal(sources.length,1);
 audio.update(10.1,false);assert(sources[0].stopped);assert.equal(audio.active.size,0);
 audio.update(10.1,true);assert.equal(sources.length,2);assert(Math.abs(sources[1].offset-.8)<1e-8);
 audio.update(null,true);assert(sources[1].stopped);assert.equal(audio.active.size,0);
 audio.update(10,true);audio.reset();assert(sources[2].stopped);assert.equal(audio.active.size,0);
});


test('entry path passes safely above the moving arena patrol',async()=>{
 const {applyCycleOpening}=await import('../src/rendering/cycle-opening.js');
 const {createRecognizers}=await import('../src/simulation/recognizers.js');
 const {flyArenaPatrol}=await import('../src/simulation/arena-patrol.js');
 const {arenaSite}=await import('../src/levels/arena.js');
 const {createScenario}=await import('../src/levels/scenario.js');
 const {world}=createScenario({layout:'blueprint',centralLabyrinth:true});
 const {RECOGNIZER_SCALE}=await import('../src/game/config.js');
 const guard=createRecognizers(()=>.5,world).find(e=>e.role==='arena-patrol'),site=arenaSite(world);let closest=Infinity;
 for(let i=0;i<=960;i++){
   if(i)flyArenaPatrol(guard,i/60,1/60);
   const p=new Vector3(),look=new Vector3();applyCycleOpening(i/960,site,p,look);
   const distance=Math.hypot(p.x-guard.x,p.z+guard.s);closest=Math.min(closest,distance);
   if(distance<12)assert(p.y>guard.y+8*RECOGNIZER_SCALE+8,'clear the crown while flying overhead');
 }
 assert(closest<4,'cross directly over the moving patrol');
});

test('Clu exterior zoom starts at the normal camera and reaches the aerial range continuously',async()=>{
 const {createRun}=await import('../src/simulation/run.js');
 const {DEFAULT_WORLD}=await import('../src/levels/scenario.js');
 const {config,FOLLOW_ZOOM,AERIAL_ZOOM}=await import('../src/game/config.js');
 const run=createRun();Object.assign(run,{x:-5000,s:-5000,yaw:0,turretYaw:0,recognizers:[],enemyTanks:[]});
 const sample=zoom=>{const rig=new CameraRig(DEFAULT_WORLD);rig.followZoom=zoom;rig.begin(run,1/60,'running');rig.update(run,run,1,1/60,'running',run);return rig;};
 const near=sample(1);assert.equal(near.camera.position.y,config.cameraHeight);
 assert(Math.abs(near.camera.position.z+run.s-config.cameraDistance)<1e-8);
 const aerialNear=new CameraRig(DEFAULT_WORLD);Object.assign(aerialNear,{aerial:true,aerialBlend:1,aerialZoom:AERIAL_ZOOM.minScale});
 aerialNear.begin(run,1/60,'running');aerialNear.update(run,run,1,1/60,'running',run);
 assert(aerialNear.camera.position.distanceTo(near.camera.position)<1e-8);
 const middle=sample(32),far=sample(FOLLOW_ZOOM.maxScale);
 assert(middle.camera.position.y>500);assert(middle.camera.position.y<far.camera.position.y);
 assert.equal(far.camera.position.y,2400);assert.equal(far.look.y,0);
});

test('cycle follow zoom has matching arena and road framing and returns to normal at minimum',()=>{
 const positions=[];
 for(const escaped of [false,true]){
  const {bike,run,rig}=setup();bike.previousZ=bike.z;bike.escaped=escaped;bike.roadSpeed=0;
  frame(rig,run,1/60);const normal=rig.camera.position.clone();
  rig.followZoom=128;rig.freshCamera=true;frame(rig,run,1/60);
  assert.equal(rig.camera.position.y,2400);positions.push(rig.camera.position.clone());
  rig.followZoom=1;rig.freshCamera=true;frame(rig,run,1/60);
  assert(rig.camera.position.distanceTo(normal)<1e-8);
 }
 assert(positions[0].distanceTo(positions[1])<1e-8);
});
