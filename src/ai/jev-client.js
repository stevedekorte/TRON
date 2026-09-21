import {hearingTarget} from '../simulation/hearing.js';
import {MAZE_LENGTH} from '../levels/maze.js';
import {config} from '../game/config.js';
import {TACTICAL} from '../game/tactical.js';
import {applyTacticalChoice} from '../simulation/tactical.js';
const PUBLIC_REQUEST_INTERVAL_MS=1200;
// Gate on recorded knowledge, never on the player's hidden live position.
function withinJevRange(e,now){
 const heard=hearingTarget(e,now),m=e.memory&&now-e.memory.seenAt<=TACTICAL.jevMemoryMaxAgeSeconds?e.memory:heard?{...heard.estimatedPosition,seenAt:heard.heardAt}:null;
 return !!m&&!e.targetGone&&now-m.seenAt<=TACTICAL.jevMemoryMaxAgeSeconds&&Math.hypot(e.x-m.x,e.s-m.s)<=MAZE_LENGTH*TACTICAL.jevRangeMazeLengths;
}
export class JevClient{
 constructor(fetchImpl=fetch,apiBase=import.meta.env?.VITE_JEV_API_BASE||''){this.apiBase=apiBase.replace(/\/$/,'');this.retryUntilMs=0;this.nextRequestMs=0;this.fetch=(...args)=>fetchImpl(...args);this.epoch=0;this.status='Off';this.history=[];this.next=0;}
 reset(){this.epoch++;this.pending?.abort();this.pending=null;this.run=null;this.next=0;this.history=[];this.status='Off';}
 update(run,playing){
  if(this.run!==run){this.reset();this.run=run;}
  if(config.aiMode!=='jev'||!playing||run.crushed){if(this.pending){this.pending.abort();this.pending=null;this.epoch++;}this.status=config.aiMode==='local'?'Local planner':config.aiMode==='jev'?'Paused':'Off';return;}
  if(this.pending||run.time<this.next||Date.now()<this.nextRequestMs)return;
  if(Date.now()<this.retryUntilMs){this.status='Local fallback: public AI cooldown';return;}
  const e=[...run.recognizers,...run.enemyTanks].find(e=>withinJevRange(e,run.time)&&e.health>0&&!e.teleport&&e.state!=='materializing'&&!e.attack&&e.tactical?.options?.length&&e.tactical.requested!==e.tactical.revision&&run.time-e.tactical.started<TACTICAL.requestMaxAge);
  if(!e){this.status='Local tactics (no nearby eligible contact)';return;}
  const t=e.tactical,revision=t.revision,at=run.time,epoch=this.epoch,snapshot=t.snapshot;
  t.requested=revision;this.next=at+TACTICAL.requestInterval;this.status='Waiting for Jev';
  const controller=new AbortController();this.pending=controller;
  const sentAt=performance.now();
  if(this.apiBase)this.nextRequestMs=Date.now()+PUBLIC_REQUEST_INTERVAL_MS;
  const timeout=setTimeout(()=>controller.abort(),TACTICAL.requestTimeoutMs);
  this.fetch(this.apiBase+'/api/jev/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot),signal:controller.signal})
   .then(async response=>{const value=await response.json();if(!response.ok){const error=new Error(value.error||'Jev unavailable');error.retryAfter=Number(response.headers?.get('Retry-After')||value.retryAfter)||0;throw error;}return value;})
   .then(answer=>{
    if(epoch!==this.epoch||this.run!==run||config.aiMode!=='jev')return;
    const accepted=withinJevRange(e,run.time)&&applyTacticalChoice(e,answer,revision,at,run.time);
    this.status=accepted?'Jev active':'Local fallback (stale or uncertain answer)';
    this.history.push({unit:e.id,time:at,latencyMs:Math.round(performance.now()-sentAt),accepted,request:snapshot,response:answer});this.history=this.history.slice(-12);
   }).catch(error=>{if(epoch!==this.epoch)return;this.status='Local fallback: '+(error.name==='AbortError'?'request timed out':error.message);this.next=run.time+10;this.retryUntilMs=Math.max(this.retryUntilMs,Date.now()+Math.min(86400,Math.max(0,error.retryAfter||0))*1000);})
   .finally(()=>{clearTimeout(timeout);if(this.pending===controller)this.pending=null;});
 }
 dispose(){this.reset();}
}
