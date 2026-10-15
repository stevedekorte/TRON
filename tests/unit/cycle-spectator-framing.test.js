import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CameraRig} from '../../src/rendering/camera-rig.js';
import {cyclePlayerPose} from '../../shared/simulation/light-cycles.js';
import {SPECTATOR_FRAMING} from '../../src/rendering/cycle-spectator-framing.js';

const bike=(id,x,z,team=id)=>({id,team,x,z,previousX:x,previousZ:z,dir:0,progress:1,alive:true,continuousArena:true});
function setup(x,z,phase='racing'){
 const cycles=[bike(0,0,0),bike(1,x,z)];
 const run={playerVehicle:'cycle',cycleSpectating:true,cycleFollowId:0,cycleRace:{phase,playerId:0,site:{x:1700,s:2400},cycles}};
 return {run,rig:new CameraRig({})};
}
function frame(rig,run){rig.update(run,run,0,1/60,'running',{});rig.camera.updateMatrixWorld();}
function point(run,id){const p=cyclePlayerPose({...run.cycleRace,playerId:id});return new Vector3(p.x,1,-p.s);}
test('spectator frames both bikes at the normal boom distance in every direction and before racing',()=>{
 for(const phase of ['racing','countdown'])for(const aspect of [16/9,1,9/16])for(const [x,z] of [[10,0],[-10,0],[0,10],[0,-10],[60,30],[1,1]]){
  const {run,rig}=setup(x,z,phase);rig.camera.aspect=aspect;rig.camera.updateProjectionMatrix();
  const normal=new CameraRig({});frame(normal,{...run,cycleSpectating:false});
  for(let i=0;i<240;i++)frame(rig,run);
  const center=point(run,0);
  assert(Math.abs(rig.camera.position.distanceTo(center)-normal.camera.position.distanceTo(center))<1e-6,'preserve follow distance');
  for(const id of [0,1]){const p=point(run,id).project(rig.camera);assert(Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z<1,`${phase}/${aspect}/${x},${z}: ${p.toArray()}`);}
 }
});
test('nearest live opponent determines framing; allies, dead and escaped bikes are excluded',()=>{
 const {run,rig}=setup(10,0);run.cycleRace.cycles.push(bike(2,-1,0,0),{...bike(3,-2,0),alive:false},{...bike(4,-3,0),escaped:true},bike(5,-50,0));
 for(let i=0;i<240;i++)frame(rig,run);
 assert(rig.camera.position.x<point(run,0).x);
 run.cycleRace.cycles[1].alive=false;
 for(let i=0;i<400;i++){
  const old=rig.spectatorOrbit.yaw;frame(rig,run);
  assert(Math.abs(rig.spectatorOrbit.yaw-old)<=SPECTATOR_FRAMING.maxOrbitRadiansPerSecond/60+1e-10,'bounded orbit speed');
 }
 assert(rig.camera.position.x>point(run,0).x);
 run.cycleRace.cycles[5].alive=false;frame(rig,run);assert.equal(rig.spectatorOrbit,null);
});
test('driving retains normal framing even with a nearby enemy',()=>{
 const {run,rig}=setup(5,0);run.cycleSpectating=false;frame(rig,run);
 assert.equal(rig.spectatorOrbit,null);assert.equal(rig.camera.position.x,point(run,0).x);
});
