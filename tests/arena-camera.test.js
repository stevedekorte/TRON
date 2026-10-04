import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {Vector3} from 'three';
import {arenaCameraIntersection} from '../src/rendering/arena-camera-collision.js';
import {LIGHT_CYCLES as C} from '../src/game/light-cycles.js';
const world={wallIntersection:()=>null};
const point=v=>({x:v.x,y:v.y,s:-v.z});
function fixture(x,z,yaw){
 const bike={id:0,alive:true,x:x/C.cellMeters,z:z/C.cellMeters,previousX:x/C.cellMeters,previousZ:z/C.cellMeters,progress:1,dir:0,yaw};
 const race={site:{x:0,s:0},phase:'racing',playerId:0,cycles:[bike],breaches:[]};
 return {bike,race,run:{playerVehicle:'cycle',cycleRace:race},rig:new CameraRig(world)};
}
test('cycle follow camera stays inside all four arena walls',()=>{
 for(const [x,z,yaw] of [[403,0,Math.PI/2],[-403,0,-Math.PI/2],[0,403,0],[0,-403,Math.PI]]){
  const {run,race,rig}=fixture(x,z,yaw);rig.update(run,run,1,1/60,'running',{});
  assert.equal(arenaCameraIntersection(race,point(rig.camera.position),point(rig.camera.position),1.2),null);
  assert(Math.abs(rig.camera.position.x)<409&&Math.abs(rig.camera.position.z)<409);
 }
});
test('tight walls and corners select a clear forward cockpit view instead of a trapped chase camera',()=>{
 for(const [x,z,yaw] of [[408,0,Math.PI/2],[-408,0,-Math.PI/2],[0,408,0],[0,-408,Math.PI],[408,408,0]]){
  const {run,race,rig}=fixture(x,z,yaw);rig.camera.aspect=1.25;
  for(let i=0;i<120;i++){
   rig.cycleGlanceInput=i<60?0:1;const result=rig.update(run,run,1,1/60,'running',{});
   assert.equal(result.hiddenCycleId,undefined,'keep the cycle visible');
   assert.equal(arenaCameraIntersection(race,point(rig.camera.position),point(rig.camera.position),1.2),null);
   assert(Math.hypot(rig.camera.position.x-x,rig.camera.position.z-z)<3);
   assert(Math.abs(rig.camera.position.y-3)<1e-6);
   assert(Math.abs(rig.camera.getWorldDirection(new Vector3()).y)<.4,'keep the forward horizon visible');
  }
 }
});
test('cockpit switches with hysteresis and gives control back to manual zoom',()=>{
 const {run,bike,rig}=fixture(380,0,Math.PI/2);
 const frame=()=>rig.update(run,run,1,1/60,'running',{});
 frame();assert(!rig.cycleCockpit);
 for(const x of [395,397,400,396,390]){bike.x=bike.previousX=x/C.cellMeters;frame();assert(rig.cycleCockpit);}
 bike.x=bike.previousX=380/C.cellMeters;for(let i=0;i<180;i++)frame();
 assert(!rig.cycleCockpit);assert(rig.cycleCockpitMix<.001);
 bike.x=bike.previousX=405/C.cellMeters;frame();assert(rig.cycleCockpit);
 rig.followZoom=8;for(let i=0;i<180;i++)frame();assert(!rig.cycleCockpit);assert(rig.camera.position.y>20);
 rig.reset();assert.equal(rig.cycleCockpitMix,0);
});
test('side glances and zoom keep the moving arena camera clear and following',()=>{
 const {run,race,bike,rig}=fixture(402,390,0);let previous;
 for(let i=0;i<420;i++){
  bike.z=bike.previousZ=(390-i*.25)/C.cellMeters;
  rig.cycleGlanceInput=i<180?1:0;rig.followZoom=i<180?1:1+8*Math.sin(Math.PI*Math.min(1,(i-180)/120))**2;
  rig.update(run,run,1,1/60,'running',{});
  const p=point(rig.camera.position);
  assert.equal(arenaCameraIntersection(race,p,p,1.2),null,`inside wall at ${i}`);
  if(previous)assert.equal(arenaCameraIntersection(race,previous,p,.2),null,`crosses wall at ${i}`);
  previous=p;
 }
 assert(Math.hypot(rig.camera.position.x-402,rig.camera.position.z-bike.z*C.cellMeters)<20);
});
test('cycle camera can pass through an actual breach, but not an intact wall or its roof',()=>{
 const race={site:{x:0,s:0},breaches:[]},a={x:0,y:3,s:400},b={x:0,y:3,s:480};
 assert.notEqual(arenaCameraIntersection(race,a,b,1.2),null);
 race.breaches.push({axis:'z',sign:-1,along:0});
 assert.equal(arenaCameraIntersection(race,a,b,1.2),null);
 assert.notEqual(arenaCameraIntersection(race,{...a,x:12},{...b,x:12},1.2),null);
 assert.notEqual(arenaCameraIntersection(race,{x:0,y:70,s:440},{x:0,y:55,s:440},1.2),null);
 assert.equal(arenaCameraIntersection(race,{...a,y:63},{...b,y:63},1.2),null);
});

test('rider fallback recovers an embedded camera and follows the cycle away from the wall',()=>{
 const {run,race,bike,rig}=fixture(408,0,Math.PI/2);
 rig.camera.position.set(430,4,0);rig.look.set(400,1,0);rig.freshCamera=false;
 for(let i=0;i<180;i++){
  const x=408-i*.3;bike.x=bike.previousX=x/C.cellMeters;
  rig.update(run,run,1,1/60,'running',{});
  const p=point(rig.camera.position);assert.equal(arenaCameraIntersection(race,p,p,1.2),null);
  assert(Math.hypot(rig.camera.position.x-x,rig.camera.position.z)<15,'camera must follow the departing bike');
 }
 assert(!rig.cycleCockpit);assert(rig.cycleCockpitMix<.001);
});
