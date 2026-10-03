import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {clipCameraSegment,constrainCamera,CAMERA_CLEARANCE} from '../src/rendering/camera-collision.js';
import {CameraRig} from '../src/rendering/camera-rig.js';
import {createRun} from '../src/simulation/run.js';

// A finite wall prism, including its roof and two ends.
const world={WALL_HEIGHT:12,wallIntersection(a,b,padding=0){
 let enter=0,leave=1;
 for(const [axis,min,max] of [['x',5,10],['y',0,12],['s',-20,20]]){
  const delta=b[axis]-a[axis],low=min-padding,high=max+padding;
  if(Math.abs(delta)<1e-10){if(a[axis]<low||a[axis]>high)return null;continue;}
  const t1=(low-a[axis])/delta,t2=(high-a[axis])/delta;
  enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
  if(enter>leave)return null;
 }
 return enter;
}};
world.lineOfSight=(a,b)=>world.wallIntersection(a,b)===null;
const p=v=>({x:v.x,y:v.y,s:-v.z});
const clear=(a,b=a)=>assert.equal(world.wallIntersection(p(a),p(b),CAMERA_CLEARANCE.radiusMeters),null);

test('long camera booms stop on the near side instead of enforcing a wall-crossing minimum distance',()=>{
 const anchor=new Vector3(0,3.5,0),end=new Vector3(1000,8,0);
 assert(clipCameraSegment(world,anchor,end));assert(end.x<3.8);clear(anchor,end);
});
test('camera sweeps around wall ends without cutting through the corner',()=>{
 const anchor=new Vector3(0,3.5,-25),wanted=new Vector3(15,5,-25);
 let previous=new Vector3(0,5,15);
 for(let i=0;i<8;i++){
  const next=wanted.clone();constrainCamera(world,anchor,next,previous);
  clear(next);clear(previous,next);previous=next;
 }
 assert(previous.distanceTo(wanted)<.001,'sliding can reach the far side around the end');
});
test('descending camera remains above or beside the roof',()=>{
 const anchor=new Vector3(0,3.5,0),previous=new Vector3(7,25,0),next=new Vector3(7,4,0);
 constrainCamera(world,anchor,next,previous);clear(next);clear(previous,next);
});
test('zoom can rise over a wall instead of remaining pinned to the tank-side face',()=>{
 const anchor=new Vector3(0,3.5,0),wanted=new Vector3(30,35,0);let previous=new Vector3(3.5,6,0);
 for(let i=0;i<10;i++){
  const next=wanted.clone();constrainCamera(world,anchor,next,previous,1.2,false);
  clear(previous,next);previous=next;
 }
 assert(previous.distanceTo(wanted)<.001);
});
test('final Clu cameras remain clear through approach, zoom, turret rotation and gunner transitions',()=>{
 const run=createRun();Object.assign(run,{x:0,s:0,yaw:Math.PI/2,turretYaw:0,recognizers:[],enemyTanks:[],impact:0});
 const rig=new CameraRig(world);let previous=null;
 for(let i=0;i<720;i++){
  run.time=i/60;rig.opening=i<180?i/180:null;
  rig.followZoom=i<180?1:1+40*Math.sin(Math.PI*Math.min(1,(i-180)/360))**2;
  run.gunner=i>=560&&i<620;run.turretYaw=i>=540?(i-540)/120:0;
  rig.begin(run,1/60,'running');rig.update(run,run,1,1/60,'running',run);
  const camera=rig.camera.position;
  assert.equal(world.wallIntersection(p(camera),p(camera),.2),null,`camera inside wall at frame ${i}`);
  if(previous)assert.equal(world.wallIntersection(p(previous),p(camera),.2),null,`camera crosses wall at frame ${i}`);
  previous=camera.clone();
 }
});

test('I/K returns continuously to the follow camera, including overhead Recognizer framing',()=>{
 for(const overhead of [false,true]){
  const empty={wallIntersection:()=>null,lineOfSight:()=>true},rig=new CameraRig(empty),run=createRun();
  Object.assign(run,{x:0,s:0,yaw:0,turretYaw:0,impact:0,recognizers:overhead?[{x:0,s:20,y:60,state:'wander'}]:[],enemyTanks:[]});
  const frame=()=>{rig.begin(run,1/60,'running');rig.update(run,run,1,1/60,'running',run);};
  for(const zoom of [1,16,1.00001]){rig.followZoom=zoom;for(let i=0;i<300;i++)frame();}
  const position=rig.camera.position.clone(),rotation=rig.camera.quaternion.clone();
  rig.followZoom=1;frame();
  assert(rig.camera.position.distanceTo(position)<.01,'no endpoint position kick');
  assert(rig.camera.quaternion.angleTo(rotation)<.001,'no stale follow pitch restored at minimum zoom');
 }
});

test('blocked camera detours horizontally and catches a tank that keeps driving',()=>{
 const rig=new CameraRig(world),run=createRun();
 Object.assign(run,{x:15,s:0,yaw:-Math.PI/2,turretYaw:0,recognizers:[],enemyTanks:[],impact:0});
 rig.freshCamera=false;rig.camera.position.set(3.75,8,0);rig.followPosition.copy(rig.camera.position);rig.look.set(15,3.5,0);
 let previous=rig.camera.position.clone(),recovered=false,maxSeparation=0;
 for(let i=0;i<360;i++){
  run.x=15+i/60*22;run.time=i/60;
  rig.begin(run,1/60,'running');rig.update(run,run,1,1/60,'running',run);
  clear(previous,rig.camera.position);assert(rig.camera.position.y<=8.1,'do not rise above follow height around the corner');previous=rig.camera.position.clone();
  recovered||=rig.collisionRecovery.active;
  maxSeparation=Math.max(maxSeparation,Math.hypot(previous.x-run.x,previous.z+run.s));
 }
 assert(recovered,'blocked follow must enter recovery');
 assert(maxSeparation<40,'tank must not drive away from a camera pinned to the wall');
 assert(!rig.collisionRecovery.active);assert(Math.abs(rig.camera.position.y-8)<.1);
});

test('clear aerial movement releases stale follow recovery even when the tank is occluded',()=>{
 const anchor=new Vector3(0,3.5,0),previous=new Vector3(15,18,0),wanted=new Vector3(200,600,0),next=wanted.clone();
 const recovery={active:true,height:13.25};
 assert.notEqual(world.wallIntersection(p(previous),p(anchor),1.2),null);
 constrainCamera(world,anchor,next,previous,1.2,false,recovery,1/60);
 assert.equal(recovery.active,false);assert(next.distanceTo(wanted)<1e-8);clear(previous,next);
});

test('CLU recovery keeps its height throughout a swept two-corner detour',()=>{
 const anchor=new Vector3(18,3.5,0),wanted=new Vector3(16,8,0),recovery={active:false};let previous=new Vector3(3.75,8,0);
 let detoured=false;
 for(let i=0;i<120;i++){
  const next=wanted.clone();constrainCamera(world,anchor,next,previous,1.2,true,recovery,1/60,true);
  clear(previous,next);assert.equal(next.y,8);detoured||=Math.abs(next.z)>21;previous=next;
 }
 assert(detoured);assert(previous.distanceTo(wanted)<.01);
});
test('CLU recovery may rise when no bounded horizontal route exists',()=>{
 const barrier={WALL_HEIGHT:12,wallIntersection:(a,b,padding)=>world.wallIntersection({...a,s:a.s*.001},{...b,s:b.s*.001},padding)};
 const anchor=new Vector3(18,3.5,0),position=new Vector3(16,8,0),previous=new Vector3(3.75,8,0),recovery={active:false};
 constrainCamera(barrier,anchor,position,previous,1.2,true,recovery,1/60,true);
 assert(recovery.active);assert.equal(recovery.waypoints,null);assert(position.y>previous.y);
 assert.equal(barrier.wallIntersection(p(previous),p(position),1.2),null);
});
