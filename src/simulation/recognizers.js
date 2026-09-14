import {formationTarget} from './formation.js';
import {retireTarget} from './target-memory.js';
import {advanceFlight,FLIGHT} from './flight.js';
import {beginCrush,advanceCrush,resolveCrush,CRUSH,stompTarget,stompApproach} from './crush.js';
import { OPEN_CELLS, MAZE_LENGTH, RECOGNIZER_STARTS, WALL_HEIGHT, freePosition, lineOfSight } from '../levels/maze.js';
import { config, RECOGNIZER_SCALE, angleDelta, clamp } from '../game/config.js';

export const SENSORS = Object.freeze({range:MAZE_LENGTH,fov:Math.PI*.82,interval:.2,radioRange:1000*.3048,radioDelay:.45,radioInterval:1.4,memorySeconds:38,predictionSeconds:5});
function random(e) {e.seed=(Math.imul(e.seed,1664525)+1013904223)>>>0;return e.seed/4294967296;}
export function createRecognizers() {
  return RECOGNIZER_STARTS.map((p,id)=>({...p,id,y:WALL_HEIGHT+22*RECOGNIZER_SCALE+12,yaw:-Math.atan2(-p.x,-p.s),
    state:'wander',health:3,hit:0,vx:0,vs:0,vy:0,seed:1982+id*199,
    targetGone:false,neutralizationSent:false,attack:null,fold:0,nextAttack:0,memory:null,canSee:false,goal:null,goalUntil:0,nextSense:id*.037,nextRadio:0,lastBroadcast:-Infinity,searchIndex:0}));
}
export function canSeeClu(e,clu) {
  if(clu.crushed)return false;
  const dx=clu.x-e.x,ds=clu.s-e.s,distance=Math.hypot(dx,ds);
  if(Math.hypot(distance,e.y-2.8)>SENSORS.range)return false;
  // Downward vision includes the area immediately under the craft.
  if(distance>(e.kind==='ground'?0:Math.max(24,(e.y-CRUSH.soleHeight)*.9)) && Math.abs(angleDelta(e.yaw,-Math.atan2(dx,ds)))>SENSORS.fov/2)return false;
  return lineOfSight({x:e.x,s:e.s,y:e.y-1},{x:clu.x,s:clu.s,y:2.8});
}
function remember(e,sighting,now) {
  if(e.targetGone)return;
  if(now-sighting.seenAt>SENSORS.memorySeconds||e.memory&&e.memory.seenAt>=sighting.seenAt)return;
  e.memory={...sighting};e.goal=null;e.goalUntil=0;e.searchIndex=0;
}
// This is the only function allowed to inspect the live tank state.
export function perceive(e,clu,now) {
  if(e.targetGone)return;
  if(now<e.nextSense)return;
  if(clu.crushed&&canSeeClu(e,{x:clu.x,s:clu.s})){retireTarget(e);return;}
  e.nextSense=now+SENSORS.interval;e.canSee=canSeeClu(e,clu);
  if(e.canSee) remember(e,{x:clu.x,s:clu.s,vx:-Math.sin(clu.yaw)*clu.speed,vs:Math.cos(clu.yaw)*clu.speed,seenAt:now,source:e.id},now);
}
export function predict(memory,now) {
  let x=memory.x,s=memory.s;
  const age=clamp(now-memory.seenAt,0,SENSORS.predictionSeconds),steps=Math.max(1,Math.ceil(age*30));
  for(let i=0;i<steps;i++) {
    const nx=x+memory.vx*age/steps,ns=s+memory.vs*age/steps;
    if(!freePosition(nx,ns,3.5))break;
    x=nx;s=ns;
  }
  return {x,s};
}
function chooseSearch(e,now) {
  const predicted=predict(e.memory,now),age=now-e.memory.seenAt;
  const radius=90+Math.min(220,age*7);
  let choices=OPEN_CELLS.filter(p=>Math.hypot(p.x-predicted.x,p.s-predicted.s)<radius);
  if(!choices.length)choices=[predicted];
  // Try several plausible places; bias toward the last observed heading.
  let best=null,bestScore=-Infinity;
  for(let i=0;i<8;i++) {
    const p=choices[Math.floor(random(e)*choices.length)];
    const heading=(p.x-e.memory.x)*e.memory.vx+(p.s-e.memory.s)*e.memory.vs;
    const score=random(e)*150+Math.max(-80,Math.min(80,heading*.025))-Math.hypot(p.x-e.x,p.s-e.s)*.12;
    if(score>bestScore){bestScore=score;best=p;}
  }
  e.searchIndex++;return {x:best.x,s:best.s};
}
// Navigation receives only the craft's own memory and the fixed map, never Clu.
export function navigate(e,now,dt,others) {
  if(advanceCrush(e,now,dt))return;
  beginCrush(e,now);if(e.attack){advanceCrush(e,now,dt);return;}
  if(e.memory&&now-e.memory.seenAt>SENSORS.memorySeconds){e.memory=null;e.goal=null;e.canSee=false;}
  if(e.memory) {
    const age=now-e.memory.seenAt;
    if(e.canSee) {e.state='pursue';e.goal=stompApproach(e,now,config.enemySpeed*1.15);e.goalUntil=now+1;}
    else if(!e.goal) {e.state='investigate';e.goal=predict(e.memory,now+SENSORS.predictionSeconds);e.goalUntil=now+12;}
    else if(e.state==='pursue'){e.state='investigate';e.goal=predict(e.memory,now+SENSORS.predictionSeconds);e.goalUntil=now+12;}
    if(!e.canSee&&(Math.hypot(e.goal.x-e.x,e.goal.s-e.s)<24||now>e.goalUntil||age>16&&e.state==='investigate')) {
      e.state='search';e.goal=chooseSearch(e,now);e.goalUntil=now+8;
    }
  } else {
    e.state='wander';
    if(!e.goal||Math.hypot(e.goal.x-e.x,e.goal.s-e.s)<25||now>e.goalUntil) {
      const p=OPEN_CELLS[Math.floor(random(e)*OPEN_CELLS.length)];
      e.goal={x:p.x,s:p.s};e.goalUntil=now+24;
    }
  }
  const formation=(e.state==='pursue'||e.state==='investigate')?formationTarget(e,others,e.goal,SENSORS.radioRange):null;
  const destination=formation||e.goal;
  const dx=destination.x-e.x,ds=destination.s-e.s,distance=Math.hypot(dx,ds);
  const observedDistance=e.memory?Math.hypot(e.memory.x-e.x,e.memory.s-e.s):Infinity;
  // Avoidance used to compete with pursuit around the same point, continually
  // reversing the requested heading. Yield the close approach to a nearer craft.
  const yielding=e.memory&&observedDistance<70&&others.some(other=>{
    if(other===e||other.state==='destroyed')return false;
    const otherDistance=Math.hypot(other.x-e.memory.x,other.s-e.memory.s);
    return otherDistance<50&&(otherDistance<observedDistance-1
      ||Math.abs(otherDistance-observedDistance)<=1&&other.id<e.id);
  });
  // Roof clearance gates the drop, not hover stability. A blocked strike should
  // leave the aircraft hovering, rather than spinning above a narrow passage.
  const strikePoint=e.memory&&e.canSee?stompTarget(e,now):null;
  const strikeDistance=strikePoint?Math.hypot(strikePoint.x-e.x,strikePoint.s-e.s):observedDistance;
  const settling=e.memory&&!formation&&strikeDistance<CRUSH.triggerDistance;
  const closeApproach=e.memory&&Math.min(distance,strikeDistance)<70;
  let headingX=dx-(closeApproach?0:e.vx*1.5),headingS=ds-(closeApproach?0:e.vs*1.5);
  const length=Math.hypot(headingX,headingS)||1;headingX/=length;headingS/=length;
  // The close approach is handled by yielding and physical clearance. Keep
  // directional avoidance for cruising, where there is room to turn.
  if(!closeApproach)for(const other of others)if(other!==e&&other.state!=='destroyed'&&Math.abs(other.y-e.y)<20) {
    const ox=e.x-other.x,os=e.s-other.s,d=Math.hypot(ox,os);
    if(d>0&&d<FLIGHT.avoidanceRadius) {
      const weight=2.5*(1-d/FLIGHT.avoidanceRadius);
      headingX+=ox/d*weight;headingS+=os/d*weight;
    }
  }
  const desired=-Math.atan2(headingX,headingS);
  if(!settling&&!yielding)e.yaw+=clamp(angleDelta(e.yaw,desired),-dt*FLIGHT.turnRate,dt*FLIGHT.turnRate);
  const alignment=Math.max(0,Math.cos(angleDelta(e.yaw,desired)));
  const cruise=config.enemySpeed*(e.state==='pursue'?1.15:e.state==='wander'?.57:.7)*(formation?.speedScale??1);
  const targetSpeed=Math.min(cruise,distance*.6)*alignment*alignment;
  const speed=Math.hypot(e.vx,e.vs),forward=-Math.sin(e.yaw)*e.vx+Math.cos(e.yaw)*e.vs;
  const braking=clamp((speed-targetSpeed)/8,0,1);
  const thrust=alignment*(FLIGHT.drag*targetSpeed+Math.max(0,targetSpeed-forward)*1.2);
  const turnInPlace=closeApproach&&Math.abs(angleDelta(e.yaw,desired))>.2;
  const hold=settling||yielding||turnInPlace;
  advanceFlight(e,dt,hold?0:thrust,hold?1:braking);
  // Feet clear the slabs, so patrols can physically fly across the whole maze.
  const altitude=WALL_HEIGHT+22*RECOGNIZER_SCALE+7+(e.state==='wander'?7:0)+Math.sin(now*.4+e.id)*1.8;
  e.vy=(altitude-e.y)*.65;e.y+=e.vy*dt;
}
export function updateRecognizers(run,dt) {
  const now=run.time,active=[...run.recognizers,...(run.enemyTanks||[])].filter(e=>e.state!=='destroyed');
  // Deliver immutable, delayed observations. Relays never refresh their timestamps.
  const waiting=[];
  for(const message of run.radio) {
    if(message.deliverAt>now){waiting.push(message);continue;}
    const receiver=active.find(e=>e.id===message.to);
    if(receiver){if(message.kind==='neutralized')retireTarget(receiver);else remember(receiver,message.sighting,now);}
  }
  run.radio=waiting;
  for(const e of active)perceive(e,run,now);
  // Share confirmed destruction through the same delayed, range-limited radio.
  for(const e of active)if(e.targetGone&&!e.neutralizationSent){
    for(const other of active)if(other!==e&&!other.targetGone&&Math.hypot(other.x-e.x,other.s-e.s,other.y-e.y)<=SENSORS.radioRange)
      run.radio.push({kind:'neutralized',to:other.id,deliverAt:now+SENSORS.radioDelay});
    e.neutralizationSent=true;
  }
  for(const e of active)if(e.memory&&e.memory.seenAt>e.lastBroadcast&&now>=e.nextRadio) {
    for(const other of active)if(other!==e&&Math.hypot(other.x-e.x,other.s-e.s,other.y-e.y)<=SENSORS.radioRange) {
      run.radio.push({to:other.id,deliverAt:now+SENSORS.radioDelay,sighting:{...e.memory}});
    }
    e.lastBroadcast=e.memory.seenAt;e.nextRadio=now+SENSORS.radioInterval;
  }
  for(const e of active.filter(e=>e.kind!=='ground')){navigate(e,now,dt,active);resolveCrush(run,e);}
  // Physical clearance backs up steering avoidance when several observers converge.
  // The 17.5 m shoulder fits within a 24 m horizontal separation envelope.
  const separation=48*RECOGNIZER_SCALE;
  for(let pass=0;pass<8;pass++)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++) {
    const a=active[i],b=active[j];if(a.kind==='ground'||b.kind==='ground')continue;const dx=a.x-b.x,ds=a.s-b.s,d=Math.hypot(dx,ds);
    if(d>=separation||Math.abs(a.y-b.y)>20||a.attack&&b.attack)continue;
    const nx=d>1e-8?dx/d:Math.cos(i*17+j*7),ns=d>1e-8?ds/d:Math.sin(i*17+j*7);
    const correction=(separation-d+.001)/2;
    if(!a.attack){const weight=b.attack?2:1;a.x+=nx*correction*weight;a.s+=ns*correction*weight;}
    if(!b.attack){const weight=a.attack?2:1;b.x-=nx*correction*weight;b.s-=ns*correction*weight;}
  }
}
