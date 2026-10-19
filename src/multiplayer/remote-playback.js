import {MP} from '../../shared/multiplayer/config.js';

export const REMOTE_PLAYBACK=Object.freeze({bufferSeconds:.075,historySeconds:.5,maxRateAdjustment:.02,clockCorrectionSeconds:2,maxFrameSeconds:.2});

// Remote presentation consumes confirmed paths on a continuous, monotonic clock.
// Packet arrival can adjust playback speed slightly, but never resets the clock.
export class RemotePlayback{
 constructor(){this.reset();}
 reset(){this.frames=[];this.tick=null;this.lastNow=null;}
 push(state,now){
  const last=this.frames.at(-1);
  if(last&&last.state.race.round!==state.race.round)this.reset();
  const previous=this.frames.at(-1);
  if(previous&&state.tick<=previous.state.tick)return;
  this.frames.push({state,now});
  const cutoff=state.tick-REMOTE_PLAYBACK.historySeconds*MP.tickHz;
  while(this.frames.length>2&&this.frames[1].state.tick<cutoff)this.frames.shift();
 }
 sample(now){
  const last=this.frames.at(-1);if(!last)return null;
  const target=last.state.tick+(now-last.now)*MP.tickHz/1000-REMOTE_PLAYBACK.bufferSeconds*MP.tickHz;
  // Loading/background pauses are not slow frames: restore the buffer on resume
  // instead of spending seconds pinned to packet boundaries while catching up.
  // A server stall can make that target older than a pose already displayed.
  // Refill by slowing/holding, never by rewinding an existing round.
  if(this.tick===null||now-this.lastNow>REMOTE_PLAYBACK.maxFrameSeconds*1000)this.tick=Math.max(this.tick??target,target);
  else{
   const dt=Math.max(0,Math.min(REMOTE_PLAYBACK.maxFrameSeconds,(now-this.lastNow)/1000));
   const expected=this.tick+dt*MP.tickHz;
   const rate=1+Math.max(-REMOTE_PLAYBACK.maxRateAdjustment,Math.min(REMOTE_PLAYBACK.maxRateAdjustment,(target-expected)/(MP.tickHz*REMOTE_PLAYBACK.clockCorrectionSeconds)));
   this.tick+=dt*MP.tickHz*rate;
  }
  this.lastNow=now;
  // Hold on a missing update rather than inventing another remote turn/path.
  this.tick=Math.max(this.frames[0].state.tick,Math.min(last.state.tick,this.tick));
  let upper=this.frames.findIndex(f=>f.state.tick>=this.tick);if(upper<0)upper=this.frames.length-1;
  const a=this.frames[Math.max(0,upper-1)].state,b=this.frames[upper].state;
  const fraction=b.tick===a.tick?1:Math.max(0,Math.min(1,(this.tick-a.tick)/(b.tick-a.tick)));
  return {a,b,fraction,tick:this.tick};
 }
}

// Walk the confirmed trail through each right-angle corner, never diagonally
// blend across it. Segment indices refer to the upper snapshot's trail array.
export function remotePose(a,b,trails,fraction){
 if(!a||!b||!a.alive||!b.alive)return b;
 const turns=b.turns-a.turns;
 if(turns<0)return b;
 const segments=[];
 for(let i=0;i<trails.length;i++)if(trails[i].bikeId===b.id&&i<=b.segment)segments.push(i);
 if(segments.length<turns+1)return b;
 const path=segments.slice(-(turns+1));
 const points=[{x:a.x,z:a.z},...path.slice(1).map(i=>({x:trails[i].x1,z:trails[i].z1})),{x:b.x,z:b.z}];
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.z-points[i].z));
 let distance=lengths.reduce((sum,n)=>sum+n,0)*fraction;
 for(let i=0;i<lengths.length;i++){
  if(distance<lengths[i]||i===lengths.length-1){
   const f=lengths[i]?Math.min(1,distance/lengths[i]):1,start=points[i],end=points[i+1];
   return {...b,x:start.x+(end.x-start.x)*f,z:start.z+(end.z-start.z)*f,dir:trails[path[i]].dir,segment:path[i]};
  }
  distance-=lengths[i];
 }
 return b;
}

export function presentRemoteCycles(race,sample,localId){
 if(!sample)return;
 const {a,b,fraction}=sample;
 if(b.race.round!==race.round||b.race.phase!=='racing')return;
 const poses=new Map();
 for(const cycle of race.cycles){
  if(cycle.id===localId||!cycle.alive)continue;
  const upper=b.race.cycles.find(c=>c.id===cycle.id),lower=a.race.cycles.find(c=>c.id===cycle.id);
  if(!upper?.alive)continue;
  const pose=remotePose(lower,upper,b.race.trails,fraction);
  // Keep current authoritative HUD/identity data; only delay spatial presentation.
  Object.assign(cycle,{x:pose.x,z:pose.z,previousX:pose.x,previousZ:pose.z,dir:pose.dir,progress:1});
  poses.set(cycle.id,pose);
 }
 if(!poses.size)return;
 const trails=[];
 for(let i=0;i<race.trails.length;i++){
  const trail=race.trails[i];if(poses.has(trail.bikeId))continue;
  const owner=race.cycles.find(c=>c.id===trail.bikeId);
  if(owner?.segment===i)owner.segment=trails.length;
  trails.push(trail);
 }
 for(let i=0;i<b.race.trails.length;i++){
  const trail=b.race.trails[i],pose=poses.get(trail.bikeId);
  if(!pose||i>pose.segment)continue;
  if(i===pose.segment){
   const owner=race.cycles.find(c=>c.id===trail.bikeId);owner.segment=trails.length;
   trails.push({...trail,x2:pose.x,z2:pose.z});
  }else trails.push(trail);
 }
 race.trails=trails;
}
