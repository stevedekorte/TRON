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
 bike.x=110;bike.previousX=109;frame(rig,run,1/60);
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
test('spectator camera follows the selected survivor without changing the player identity',()=>{
 const {run,rig,bike}=setup();bike.alive=false;
 const survivor={...bike,id:2,alive:true,x:20,previousX:20,z:0,previousZ:0};
 run.cycleRace.cycles.push(survivor);run.cycleSpectating=true;run.cycleFollowId=2;
 for(let i=0;i<120;i++)frame(rig,run,1/60);
 const pose=cyclePlayerPose({...run.cycleRace,playerId:2});
 assert(Math.hypot(rig.camera.position.x-pose.x,rig.camera.position.z+pose.s)<11);
 assert.equal(run.cycleRace.playerId,0);
 const before=rig.camera.position.clone();survivor.x++;survivor.previousX++;
 frame(rig,run,1/60);assert(Math.abs(rig.camera.position.x-before.x-4.8)<1e-9);
});
test('materialization holds its shot then cuts immediately to follow',()=>{
 const {bike,run,rig}=setup();bike.z=bike.previousZ=-84;bike.dir=2;
 rig.cycleOpening=1.05;frame(rig,run,1/60);const held=rig.camera.position.clone();
 rig.cycleOpening=1.1;frame(rig,run,1/60);assert(rig.camera.position.equals(held));
 rig.finishCycleOpening();assert(rig.freshCamera);frame(rig,run,1/60);
 assert(rig.camera.position.distanceTo(held)>2);
 const cut=rig.camera.position.clone();frame(rig,run,1/60);
 assert(rig.camera.position.distanceTo(cut)<1e-6,'no post-cut transition');
});
test('cycle glances retain side orbit and a visible horizon throughout I/K zoom',()=>{
 for(const escaped of [false,true])for(const zoom of [1,2,8,32,128])for(const side of [-1,1]){
  const {bike,run,rig}=setup();bike.escaped=escaped;rig.followZoom=zoom;
  for(let i=0;i<180;i++)frame(rig,run,1/60);
  const original=rig.camera.quaternion.clone();
  rig.cycleGlanceInput=side;
  for(let i=0;i<240;i++)frame(rig,run,1/60);
  const direction=rig.camera.getWorldDirection(new Vector3());
  const horizon=direction.clone().setY(0).normalize().multiplyScalar(10000).add(rig.camera.position).project(rig.camera);
  assert(Math.abs(horizon.y)<.8,`horizon clipped at zoom ${zoom}, escaped ${escaped}`);
  assert(Math.abs(direction.x)>.2,'zoom must retain sideways glance');
  rig.cycleGlanceInput=0;
  for(let i=0;i<300;i++)frame(rig,run,1/60);
  assert(rig.camera.quaternion.angleTo(original)<.001,'release restores the zoomed follow view');
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
  assert(p.y>=1.6-1e-6);assert.equal(roll,0);
 }
 const before=sample(5),down=sample(10.5),arrival=sample(16);
 assert(before.d.x<-.9,'initially face the maze');
 assert(down.d.y<-.9,'look steeply down at the grid before accelerating');
 assert(down.d.z<0&&Math.abs(down.d.x)<.1,'pan right toward the far end');
 assert(sample(12).p.distanceTo(sample(14).p)>sample(7).p.distanceTo(sample(9).p)*2,'rapid floor traverse follows slow descent');
 for(let t=7;t<12;t+=.05)assert(sample(t+.05).p.distanceTo(sample(t).p)/.05>35,'keep moving through the downward turn');
 assert(arrival.p.distanceTo(new Vector3(1408,1.6,-2995.06))<1e-6);
 assert(arrival.d.x<-.7&&arrival.d.z<-.5,'frame the cycles from the right at an angle');
 assert.equal(CYCLE_OPENING.formationSeconds,2.75/1.5);
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


test('entry path passes safely in front of the moving arena patrol',async()=>{
 const {applyCycleOpening}=await import('../src/rendering/cycle-opening.js');
 const {createRecognizers}=await import('../src/simulation/recognizers.js');
 const {flyArenaPatrol}=await import('../src/simulation/arena-patrol.js');
 const {arenaSite}=await import('../src/levels/arena.js');
 const {createScenario}=await import('../src/levels/scenario.js');
 const {world}=createScenario({layout:'blueprint',centralLabyrinth:true});
 const {RECOGNIZER_SCALE}=await import('../src/game/config.js');
 const guard=createRecognizers(()=>.5,world).find(e=>e.role==='arena-patrol'),site=arenaSite(world);let closest=Infinity,frontView=false;
 for(let i=0;i<=960;i++){
   if(i)flyArenaPatrol(guard,i/60,1/60);
   const p=new Vector3(),look=new Vector3();applyCycleOpening(i/960,site,p,look);
   const distance=Math.hypot(p.x-guard.x,p.z+guard.s);closest=Math.min(closest,distance);
   const towardCamera=new Vector3(p.x-guard.x,0,p.z+guard.s),forward=new Vector3(-Math.sin(guard.yaw),0,-Math.cos(guard.yaw));
   if(distance<35&&towardCamera.clone().normalize().dot(forward)>.3&&look.clone().sub(p).dot(towardCamera.clone().negate())>0)frontView=true;
   if(distance<12)assert(p.y>guard.y+8*RECOGNIZER_SCALE+8,'clear the crown while flying overhead');
 }
 assert(closest<30,'retain a close flyby');assert(frontView,'see the front of the patrol during the pass');
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
  const {bike,run,rig}=setup();bike.previousZ=bike.z;bike.escaped=escaped;bike.roadSpeed=55;
  frame(rig,run,1/60);const normal=rig.camera.position.clone();
  rig.followZoom=128;rig.freshCamera=true;frame(rig,run,1/60);
  assert.equal(rig.camera.position.y,2400);positions.push(rig.camera.position.clone());
  rig.followZoom=1;rig.freshCamera=true;frame(rig,run,1/60);
  assert(rig.camera.position.distanceTo(normal)<1e-8);
 }
 assert(positions[0].distanceTo(positions[1])<1e-8);
});

test('death camera stays at wall height and tracks survivors from a fixed perch',async()=>{
 const {ARENA_WALL}=await import('../src/game/arena-breaches.js');
 const {bike,run,rig}=setup();
 bike.x=84;bike.previousX=84;frame(rig,run,1/60);
 const start=rig.camera.position.clone();bike.alive=false;run.cycleSpectating=true;run.cycleFollowId=null;
 const survivor={...bike,id:1,alive:true,x:20,previousX:20,z:0,previousZ:0};
 run.cycleRace.cycles.push(survivor);
 const rotation=rig.camera.quaternion.clone();
 for(let i=0;i<180;i++){frame(rig,run,1/60);assert(rig.camera.position.equals(start));assert(rig.camera.quaternion.equals(rotation));}
 frame(rig,run,1/60);assert(rig.camera.position.distanceTo(start)<1);
 for(let i=0;i<240;i++){
  frame(rig,run,1/60);
  assert(rig.camera.position.y<=66);
  if(rig.camera.position.y<65)assert(Math.abs(rig.camera.position.x-start.x)<1e-8);
 }
 const center=new Vector3(run.cycleRace.site.x,0,-run.cycleRace.site.s);
 assert.equal(rig.camera.position.y,66);
 assert(Math.abs(rig.camera.position.x-center.x-(ARENA_WALL.innerMeters+1))<1e-8);
 const perch=rig.camera.position.clone();
 survivor.x=-20;survivor.previousX=-20;
 for(let i=0;i<180;i++)frame(rig,run,1/60);
 assert(rig.camera.position.distanceTo(perch)<1e-8);
 const pose=cyclePlayerPose({...run.cycleRace,playerId:1});
 const aim=new Vector3(pose.x,1,-pose.s);
 assert(rig.camera.getWorldDirection(new Vector3()).dot(aim.sub(perch).normalize())>.99999);
 survivor.alive=false;run.cycleRace.cycles.push({...survivor,id:2,alive:true});frame(rig,run,1/60);
 assert.equal(rig.cycleOverview.trackedId,2);
 run.cycleRace.cycles[2].alive=false;
 for(let i=0;i<180;i++)frame(rig,run,1/60);
 assert.equal(rig.cycleOverview.trackedId,null);
 assert(Number.isFinite(rig.camera.quaternion.w));
 rig.reset();assert.equal(rig.cycleOverview,null);
});


test('I/K follow zoom keeps both horizon and cycle in frame throughout zoom transitions',()=>{
 for(const escaped of [false,true]){
  const {bike,run,rig}=setup();bike.escaped=escaped;
  for(const zoom of [1,2,8,32,128,32,8,2,1]){
   rig.followZoom=zoom;
   for(let i=0;i<90;i++){
    const bikeScreen=frame(rig,run,1/60);
    const direction=rig.camera.getWorldDirection(new Vector3());
    const horizon=direction.setY(0).normalize().multiplyScalar(10000).add(rig.camera.position).project(rig.camera);
    assert(Math.abs(horizon.y)<.8,`horizon clipped at zoom ${zoom}`);
    assert(Math.abs(bikeScreen.y)<.95,`bike clipped at zoom ${zoom}`);
   }
  }
 }
});


test('spectator switches preserve zoom and ease between moving targets, including rapid switches',()=>{
 const {run,rig,bike}=setup();bike.alive=false;
 run.cycleRace.cycles.push({...bike,id:1,alive:true,x:25,previousX:25,z:0,previousZ:0},{...bike,id:2,alive:true,x:-25,previousX:-25,z:15,previousZ:15});
 run.cycleSpectating=true;run.cycleFollowId=1;rig.followZoom=8;rig.aerialZoom=1.5;
 frame(rig,run,1/60);const start=rig.camera.position.clone();
 run.cycleFollowId=2;frame(rig,run,1/60);
 assert(rig.camera.position.distanceTo(start)<.1,'first frame must not teleport to the other bike');
 for(let i=0;i<30;i++){run.cycleRace.cycles[2].x+=.02;run.cycleRace.cycles[2].previousX+=.02;frame(rig,run,1/60);}
 const mid=rig.camera.position.clone();assert(mid.distanceTo(start)>10);
 run.cycleFollowId=1;frame(rig,run,1/60);assert(rig.camera.position.distanceTo(mid)<.1,'rapid reversal starts at the displayed camera');
 for(let i=0;i<100;i++)frame(rig,run,1/60);
 assert.equal(rig.followZoom,8);assert.equal(rig.aerialZoom,1.5);assert.equal(rig.cycleSwitch,null);
 assert(rig.camera.position.distanceTo(start)<.01,'settles at the original zoomed framing');
 rig.reset();assert.equal(rig.cycleSwitch,null);
});


test('spectator rotation eases through opposite headings without a look-at flip',()=>{
 const {run,rig,bike}=setup();bike.alive=false;
 run.cycleRace.cycles.push({...bike,id:1,alive:true,x:20,previousX:20,z:0,previousZ:0,dir:0},{...bike,id:2,alive:true,x:-20,previousX:-20,z:0,previousZ:0,dir:2});
 run.cycleSpectating=true;run.cycleFollowId=1;frame(rig,run,1/60);
 const start=rig.camera.quaternion.clone();run.cycleFollowId=2;
 let previous=start.clone(),largest=0;
 for(let i=0;i<100;i++){
  frame(rig,run,1/60);const angle=previous.angleTo(rig.camera.quaternion);largest=Math.max(largest,angle);
  if(i===0)assert(angle<.001,'rotation must ease out of the previous view');
  assert(angle<.1,`abrupt rotation at frame ${i}: ${angle}`);previous.copy(rig.camera.quaternion);
 }
 assert(start.angleTo(rig.camera.quaternion)>3,'completes the opposite-heading turn');assert(largest>.01);
 run.cycleFollowId=1;frame(rig,run,1/60);for(let i=0;i<20;i++)frame(rig,run,1/60);
 previous.copy(rig.camera.quaternion);run.cycleFollowId=2;frame(rig,run,1/60);
 assert(previous.angleTo(rig.camera.quaternion)<.001,'rapid selection preserves displayed orientation');
});


test('a followed survivor death holds the displayed camera before selecting another, and manual selection can skip it',()=>{
 const {bike,run,rig}=setup();bike.alive=false;
 const survivor={...bike,id:1,alive:true,x:20,previousX:20},next={...bike,id:2,alive:true,x:-20,previousX:-20};
 run.cycleRace.cycles.push(survivor,next);run.cycleSpectating=true;run.cycleFollowId=1;
 frame(rig,run,1/60);const position=rig.camera.position.clone(),rotation=rig.camera.quaternion.clone();
 survivor.alive=false;
 for(let i=0;i<120;i++){frame(rig,run,1/60);assert(rig.camera.position.equals(position));assert(rig.camera.quaternion.equals(rotation));}
 const elapsed=rig.cycleDeathHold.elapsed;
 rig.update(run,run,0,1,'paused',{});assert.equal(rig.cycleDeathHold.elapsed,elapsed);
 for(let i=0;i<65;i++)frame(rig,run,1/60);
 assert.equal(rig.cycleDeathHold.elapsed,3);assert(rig.camera.position.equals(position));
 run.cycleFollowId=2;frame(rig,run,1/60);assert.equal(rig.cycleDeathHold,null);assert(rig.cycleSwitch);
 for(let i=0;i<90;i++)frame(rig,run,1/60);
 next.alive=false;frame(rig,run,1/60);assert.equal(rig.cycleDeathHold.id,2);
 survivor.alive=true;run.cycleFollowId=1;frame(rig,run,1/60);assert.equal(rig.cycleDeathHold,null);
 rig.reset();assert.equal(rig.cycleDeathsHeld.size,0);
});
test('actual cycle speed smoothly shortens turbo follow distance and lengthens braking distance',()=>{
 const {run,rig,bike}=setup();bike.progress=1;frame(rig,run,1/60);
 const distance=()=>Math.hypot(rig.camera.position.x-cyclePlayerPose(run.cycleRace).x,rig.camera.position.z+cyclePlayerPose(run.cycleRace).s);
 assert(Math.abs(distance()-10)<1e-8);
 bike.speedMultiplier=2.5;frame(rig,run,1/60);assert(distance()<10&&distance()>9.9);
 for(let i=0;i<360;i++)frame(rig,run,1/60);assert(Math.abs(distance()-7.8)<.001);
 bike.speedMultiplier=.5;for(let i=0;i<360;i++)frame(rig,run,1/60);assert(Math.abs(distance()-10.8)<.001);
 rig.reset();assert.equal(rig.cycleSpeedDistanceScale,1);
});
test('road speed and spectator target determine the speed camera response',()=>{
 const {run,rig,bike}=setup();bike.progress=1;bike.alive=false;
 const target={...bike,id:2,alive:true,escaped:true,roadSpeed:80};run.cycleRace.cycles.push(target);run.cycleSpectating=true;run.cycleFollowId=2;
 for(let i=0;i<360;i++)frame(rig,run,1/60);assert(rig.cycleSpeedDistanceScale<1);
 target.roadSpeed=0;for(let i=0;i<360;i++)frame(rig,run,1/60);assert(Math.abs(rig.cycleSpeedDistanceScale-1.16)<.001);
});
test('curved trail connection stays fixed at the rear axle across render fractions and speeds',async()=>{
 const {Group,Matrix4}=await import('three');
 const {interpolateCycleRace}=await import('../src/rendering/cycle-poses.js');
 const {LightCycleWalls,CYCLE_WALL_STYLE}=await import('../src/rendering/light-cycle-walls.js');
 const root=new Group(),walls=new LightCycleWalls(root),matrix=new Matrix4();
 for(const [dir,dx,dz] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]])for(const travel of [.03,.0666667,.1666667]){
  const b={id:0,team:0,alive:true,continuousArena:true,segment:0,dir,x:dx*20,z:dz*20,previousX:dx*(20-travel),previousZ:dz*(20-travel),progress:1,renderTravel:travel,renderPrevious:{x:dx*(20-travel),z:dz*(20-travel),dir}};
  const race={phase:'racing',time:1,cycles:[b],trails:[{bikeId:0,team:0,dir,x1:0,z1:0,x2:b.x,z2:b.z}],crashes:[]};
  for(const alpha of [0,.1,.8,.3,.99,1]){
   const rendered=interpolateCycleRace(race,alpha),bike=rendered.cycles[0];walls.update(rendered,1);
   walls.meshes[0].getMatrixAt(0,matrix);
   const end=new Vector3(.5,0,0).applyMatrix4(matrix);
   const behind=(bike.x*4.8-end.x)*dx+(bike.z*4.8-end.z)*dz;
   assert(Math.abs(behind-CYCLE_WALL_STYLE.rearAxleBehindMeters)<.00002,`${dir}/${travel}/${alpha}: ${behind}`);
   assert.equal(race.trails[0].x2,b.x);assert.equal(race.cycles[0].renderTrailLagMeters,undefined);
  }
 }
 for(const mesh of walls.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

test('arena turn tracking becomes gentler with distance for player and spectator views',()=>{
 for(const spectating of [false,true]){
  const turns=[];
  for(const zoom of [1,16,128]){
   const {bike,run,rig}=setup();rig.followZoom=zoom;
   if(spectating){run.cycleSpectating=true;run.cycleFollowId=0;}
   for(let i=0;i<180;i++)frame(rig,run,1/60);
   const before=rig.camera.quaternion.clone();bike.dir=1;
   for(let i=0;i<12;i++)frame(rig,run,1/60);
   turns.push(before.angleTo(rig.camera.quaternion));
   for(let i=0;i<600;i++)frame(rig,run,1/60);
   assert(Math.abs(Math.sin(rig.cycleTrackingYaw-cyclePlayerPose(run.cycleRace).yaw))<.001,'eventually aligns with cycle');
  }
  assert(turns[0]>turns[1]&&turns[1]>turns[2],`turn rotation should decrease with distance: ${turns}`);
 }
});
