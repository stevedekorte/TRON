// Start with supersampling for fine aircraft detail. Back off under sustained
// load, then retry cautiously after headroom returns; transient stalls must not
// permanently lower scene quality for the rest of the session.
export const ADAPTIVE_AA={targetFps:60,windowSeconds:2,settleSeconds:3,upgradeSeconds:24,slowFrameRatio:1.2,slowFraction:.2,upgradeFrameRatio:1.06,maxFrameSeconds:.25,maxPixelRatio:2,pixelBudget:6000000,retrySeconds:60,maxRetrySeconds:300};
export function supportedSamples(gl){
 const color=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
 const depth=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH24_STENCIL8,gl.SAMPLES)||[]);
 return [0,...color.filter(n=>n<=8&&depth.includes(n))].sort((a,b)=>a-b);
}
export function aaLevels(samples){
 const choose=n=>Math.max(0,...samples.filter(s=>s<=n));
 return [[1,0],[1,2],[1,4],[1.25,4],[1.5,4],[1.5,8],[2,8]]
  .map(([ratio,n])=>({ratio,samples:choose(n)})).filter((v,i,a)=>!a.slice(0,i).some(p=>p.ratio===v.ratio&&p.samples===v.samples));
}
export class AdaptiveAA{
 constructor(samples,options=ADAPTIVE_AA){this.options=options;this.levels=aaLevels(samples);this.reset();}
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
   this.index--;this.reason='frame budget';this.clear();return true;
  }
  if(this.stable>=this.options.upgradeSeconds&&this.index<this.ceiling){
   this.index++;this.reason='sustained headroom';this.clear();return true;
  }
  return false;
 }
}
