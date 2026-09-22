import {DEFAULT_WORLD,worldFor} from '../levels/scenario.js';
import {DATA_BEAM} from '../simulation/data-beams.js';
import {Vector3} from 'three';
export function musicCategory(path){
 const name=decodeURIComponent(path).split('/').pop().toLowerCase();
 if(/\b(recognized|recongized)\b/.test(name))return 'recognized';
 if(/\bpursued\b/.test(name))return 'pursued';
 if(/\bgotcha\b/.test(name))return 'gotcha';
 return null;
}
export function selectMusic(clips,category,current,random=Math.random){
 const matches=clips.filter(c=>c.category===category),alternatives=matches.filter(c=>c.url!==current);
 const pool=alternatives.length?alternatives:matches;
 return pool.length?pool[Math.floor(random()*pool.length)].url:null;
}
export function activelyPursued(run){
 return !run.crushed&&[...run.recognizers,...(run.enemyTanks||[])].some(e=>!e.targetGone&&['pursue','fold','drop'].includes(e.state));
}

export const MUSIC_CUES=Object.freeze({closeDistance:100,releaseDistance:140,fadeOut:.45,fadeIn:.3,quietFade:3});
export function closeRecognizer(run,wasClose){
 if(run.crushed)return false;
 const distance=wasClose?MUSIC_CUES.releaseDistance:MUSIC_CUES.closeDistance;
 return run.recognizers.some(e=>!e.targetGone&&['pursue','fold','drop'].includes(e.state)&&Math.hypot(e.x-run.x,e.s-run.s,e.y-2.8)<distance);
}

export function quietMazeExploration(run){
 const {MAZE_INSTANCES,BASIS,FLOOR_HALF}=worldFor(run);
 if(run.crushed||activelyPursued(run))return false;
 const determinant=BASIS.a*BASIS.d-BASIS.b*BASIS.c;
 return MAZE_INSTANCES.some(m=>{
  const dx=run.x-m.x,ds=run.s-m.s,c=Math.cos(m.angle),s=Math.sin(m.angle);
  const x=c*dx+s*ds,z=-s*dx+c*ds;
  const u=(BASIS.d*x-BASIS.b*z)/determinant,v=(-BASIS.c*x+BASIS.a*z)/determinant;
  return Math.abs(u)<FLOOR_HALF[0]&&Math.abs(v)<FLOOR_HALF[1];
 });
}

export const MAZE_MUSIC={nearDistance:120,fadeSeconds:1.8};
export const MAZE_CUE_RANK={approaching:1,spotted:2,enter:3,afterglow:4};
export function beamBaseVisible(beam,camera,world=DEFAULT_WORLD){
 const {lineOfSight}=world;
 const point=new Vector3(beam.x,.25,-beam.s).project(camera);
 return point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&lineOfSight({x:camera.position.x,s:-camera.position.z,y:camera.position.y},{x:beam.x,s:beam.s,y:.25});
}
export function mazeMusicCue(run,visible){
 if(!quietMazeExploration(run))return null;
 const near=(run.dataBeams||[]).filter(b=>b.collectedAt===null&&Math.hypot(run.x-b.x,run.s-b.s)<=MAZE_MUSIC.nearDistance).sort((a,b)=>Math.hypot(run.x-a.x,run.s-a.s)-Math.hypot(run.x-b.x,run.s-b.s))[0];
 return near?{category:Math.hypot(run.x-near.x,run.s-near.s)<=DATA_BEAM.radius?'enter':visible(near)?'spotted':'approaching',beamId:near.id}:{category:'exploration',beamId:null};
}
