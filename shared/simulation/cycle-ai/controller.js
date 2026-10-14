import {LIGHT_CYCLES as C} from '../config/light-cycles.js';
import {ArenaQueries} from './geometry.js';
import {AI_LIMITS as L,DEFAULT_POLICY,validatePolicy} from './config.js';
import {evaluateCandidate} from './evaluate.js';
const contexts=new WeakMap();
export const usesBoundedAI=r=>r.aiMode==='bounded'||r.aiMode!=='classic'&&(!!r.closedArena||r.startWithBreach===false&&!r.breaches?.length);
export function resetCycleAI(r){contexts.delete(r);}
function random(state){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
function context(r){
 let ctx=contexts.get(r);
 if(!ctx||ctx.round!==r.round){
  ctx={round:r.round,tick:0,geometry:new ArenaQueries(),bots:new Map(),plans:0,guards:0,totalMilliseconds:0,totals:{cutoffPlans:0,turboPlans:0,brakePlans:0,guardTicks:0}};contexts.set(r,ctx);
 }
 return ctx;
}
export function cycleAIDebug(r){const ctx=contexts.get(r);return ctx?{tick:ctx.tick,totalMilliseconds:ctx.totalMilliseconds,totals:{...ctx.totals},plans:ctx.plans,guards:ctx.guards,segmentTests:ctx.geometry.tests,overflow:ctx.geometry.overflow,bots:[...ctx.bots.values()].map(b=>({id:b.id,reason:b.reason,dir:b.dir,pedal:b.pedal,decisions:b.decisions}))}:null;}
// Return commands first; the caller applies them only after all observations.
export function planCycleAI(r,elapsed=r.elapsed??r.time){
 const ctx=context(r),start=r.aiMeasure?performance.now():0,q=ctx.geometry;ctx.tick=Math.floor(elapsed*L.tickHz+1e-7);ctx.plans=0;ctx.guards=0;
 if(!r.cycles.some(b=>b.alive&&!b.escaped&&!b.human&&b.id!==r.playerId&&b.aiController!=='classic')){if(r.aiMeasure)r.aiMetrics={milliseconds:0,plans:0,segmentTests:0};return ctx.bots;}
 q.rebuild(r);
 for(const b of r.cycles){
  if(!b.alive||b.escaped||b.human||b.aiController==='classic'||b.id===r.playerId)continue;
  let state=ctx.bots.get(b.id);
  if(!state){state={id:b.id,seed:((r.seed^Math.imul(b.id+1,2654435761)^r.round)>>>0),dir:b.dir,pedal:0,turnAt:-Infinity,decisions:0,reason:'space',policy:validatePolicy(b.aiPolicy??r.aiPolicy??DEFAULT_POLICY),candidates:Array.from({length:L.maxCandidates},()=>({}))};ctx.bots.set(b.id,state);}
  state.turn=0;
  const target=r.cycles.find(c=>c.id===state.targetId);
  if(!target?.alive||(ctx.tick+b.id)%60===0){
   let nearest=Infinity,chosen=null;
   for(const other of r.cycles){if(!other.alive||other.escaped||other.team===b.team)continue;
    const distance=Math.hypot(other.x-b.x,other.z-b.z)*(other.id===state.targetId ? .85 : 1);
    if(distance<nearest){nearest=distance;chosen=other.id;}
   }
   state.targetId=chosen;
  }
  const speed=C.speedMetersPerSecond*(b.speedMultiplier??1),guardCells=Math.max(speed,C.speedMetersPerSecond)*(L.guardSeconds+L.safetySeconds)/C.cellMeters;
  const clearance=q.clearance(b,b.dir,guardCells+1),traffic=q.trafficClearance(b,b.dir,L.guardSeconds+L.safetySeconds,Math.max(speed,C.speedMetersPerSecond));
  const danger=Math.min(clearance,traffic)<guardCells;
  if((ctx.tick+b.id)%L.planTicks===0&&state.lastDecisionTick!==ctx.tick&&ctx.plans<L.maxPlansPerTick){
   ctx.plans++;state.decisions++;state.lastDecisionTick=ctx.tick;let best=null,count=0;
   for(const dir of [b.dir,(b.dir+1)%4,(b.dir+3)%4]){
    const clear=q.clearance(b,dir),space=q.space(b,dir);
    for(const pedal of [0,1,-1]){
     const candidate=evaluateCandidate(q,b,dir,pedal,clear,space,state.policy,state.candidates[count++],state.targetId);
     if(dir!==state.dir)candidate.score-=state.policy.switchCost;
     if(candidate.safe&&(!best||candidate.score>best.score))best=candidate;
    }
   }
   if(best){
    const threshold=best.score-Math.min(L.nearBestTolerance,state.policy.variation);let eligible=0,choice=best;
    for(let i=0;i<count;i++){const c=state.candidates[i];if(c.safe&&c.score>=threshold&&random(state)<1/++eligible)choice=c;}
    state.dir=choice.dir;state.pedal=choice.pedal;state.reason=choice.reason;if(choice.cutoff>0)ctx.totals.cutoffPlans++;if(choice.pedal===1)ctx.totals.turboPlans++;if(choice.pedal===-1)ctx.totals.brakePlans++;
   }
  }
  if(danger){
   ctx.guards++;ctx.totals.guardTicks++;state.pedal=-1;state.reason='escape';let best=0,dir=b.dir;
   for(const d of [b.dir,(b.dir+1)%4,(b.dir+3)%4]){
    const room=Math.min(q.clearance(b,d,guardCells+3),q.trafficClearance(b,d,L.guardSeconds+L.safetySeconds,Math.max(speed,C.speedMetersPerSecond)));
    if(room>best){best=room;dir=d;}
   }
   state.dir=dir;if(dir!==b.dir&&best>=guardCells)state.pedal=0;
  }
  const delta=(state.dir-b.dir+4)%4;
  if((delta===1||delta===3)&&ctx.tick-state.turnAt>=L.turnTicks){state.turn=delta===1?1:-1;state.turnAt=ctx.tick;}
  else if(delta===2){state.dir=b.dir;state.pedal=0;}
  b.aiTurbo=state.pedal===1;b.aiBrake=state.pedal===-1;
 }
 if(r.aiMeasure){const milliseconds=performance.now()-start;ctx.totalMilliseconds+=milliseconds;r.aiMetrics={milliseconds,plans:ctx.plans,segmentTests:q.tests};}
 return ctx.bots;
}
