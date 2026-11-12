// Start with supersampling for fine aircraft detail. Back off under sustained
// load, then retry cautiously after headroom returns; transient stalls must not
// permanently lower scene quality for the rest of the session.
export const ADAPTIVE_AA={targetFps:60,windowSeconds:2,settleSeconds:3,upgradeSeconds:24,slowFrameRatio:1.2,slowFraction:.2,upgradeFrameRatio:1.06,maxFrameSeconds:.25,maxPixelRatio:2,pixelBudget:6000000,retrySeconds:60,maxRetrySeconds:300};
export function supportedSamples(gl){
 const color=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
 const depth=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH24_STENCIL8,gl.SAMPLES)||[]);
 return [0,...color.filter(n=>n<=8&&depth.includes(n))].sort((a,b)=>a-b);
}
// One ladder for scene quality, in ascending cost: [pixel ratio, MSAA samples,
// POV-Ray cycles allowed]. Under load it steps down through supersampling and
// 8x MSAA, then POV-Ray cycles, then light MSAA, and only then below one render
// pixel per CSS pixel. Recovery climbs back the same way.
export const QUALITY_LADDER=Object.freeze([
 [.5,0,false],[.7,0,false],[.85,0,false],
 [1,0,false],[1,2,false],[1,4,false],
 [1,4,true],[1.25,4,true],[1.5,4,true],[1.5,8,true],[2,8,true],
]);
export function aaLevels(samples){
 const choose=n=>Math.max(0,...samples.filter(s=>s<=n));
 return QUALITY_LADDER
  .map(([ratio,n,pov])=>({ratio,samples:choose(n),pov})).filter((v,i,a)=>!a.slice(0,i).some(p=>p.ratio===v.ratio&&p.samples===v.samples&&p.pov===v.pov));
}
export class AdaptiveAA{
 constructor(samples,options=ADAPTIVE_AA){this.options=options;this.levels=aaLevels(samples);this.povRelevant=false;this.reset();}
 // Outside POV-Ray cycle play, levels differing only in the POV flag cost the
 // same; steps skip such duplicates instead of spending a window on each.
 setPovRelevant(relevant){this.povRelevant=!!relevant;}
 same(a,b){return a.ratio===b.ratio&&a.samples===b.samples&&(!this.povRelevant||a.pov===b.pov);}
 next(direction){
  const from=this.levels[this.index];let i=this.index+direction;
  while(i+direction>=0&&i+direction<this.levels.length&&this.same(this.levels[i],from))i+=direction;
  return i;
 }
 /** Explicit selections (e.g. choosing POV-Ray cycles) may raise quality immediately. */
 raiseTo(index){if(index>this.index){this.index=index;this.retries.delete(index);this.reason='selected';}this.clear();}
 reset(){this.index=this.levels.findLastIndex(l=>l.ratio<=1.5&&l.samples<=4);this.clock=0;this.retries=new Map();this.reason='initial';this.clear();}
 get ceiling(){const blocked=[...this.retries].filter(([index,retry])=>index>this.index&&retry.at>this.clock).map(([index])=>index-1);return Math.min(this.levels.length-1,...blocked);}
 clear(){this.elapsed=0;this.frames=0;this.slow=0;this.stable=0;this.settle=this.options.settleSeconds;}
 get quality(){return this.levels[this.index];}
 sample(dt,active=true,targetFps=this.options.targetFps){
  if(!active||!Number.isFinite(dt)||dt<=0||dt>this.options.maxFrameSeconds){this.clear();return false;}
  this.clock+=dt;
  if(this.settle>0){this.settle-=dt;return false;}
  const budget=1/targetFps;
  this.elapsed+=dt;this.frames++;if(dt>budget*this.options.slowFrameRatio)this.slow++;
  if(this.elapsed<this.options.windowSeconds)return false;
  const overloaded=this.slow/this.frames>this.options.slowFraction;
  const comfortable=this.elapsed/this.frames<=budget*this.options.upgradeFrameRatio;
  this.stable=comfortable?this.stable+this.elapsed:0;
  this.elapsed=0;this.frames=0;this.slow=0;
  if(overloaded&&this.index>0){
   const failures=(this.retries.get(this.index)?.failures??0)+1;
   this.retries.set(this.index,{failures,at:this.clock+Math.min(this.options.maxRetrySeconds,this.options.retrySeconds*2**Math.min(failures-1,8))});
   this.index=this.next(-1);this.reason='frame budget';this.clear();return true;
  }
  if(this.stable>=this.options.upgradeSeconds&&this.index<this.ceiling){
   this.index=Math.min(this.ceiling,this.next(1));this.reason='sustained headroom';this.clear();return true;
  }
  return false;
 }
}
