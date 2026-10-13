// Deliberately conservative: a rejected quality level cannot be retried until
// the page reloads (or the developer explicitly resets it).
export const ADAPTIVE_AA={targetFps:60,windowSeconds:2,settleSeconds:3,upgradeSeconds:24,slowFrameRatio:1.2,slowFraction:.2,upgradeFrameRatio:1.06,maxFrameSeconds:.25,maxPixelRatio:2,pixelBudget:6000000};
export function supportedSamples(gl){
 const color=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
 const depth=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH24_STENCIL8,gl.SAMPLES)||[]);
 return [0,...color.filter(n=>n<=8&&depth.includes(n))].sort((a,b)=>a-b);
}
export function aaLevels(samples){
 const choose=n=>Math.max(0,...samples.filter(s=>s<=n));
 return [[.85,0],[1,0],[1,2],[1,4],[1.25,4],[1.5,4],[1.5,8],[2,8]]
  .map(([ratio,n])=>({ratio,samples:choose(n)})).filter((v,i,a)=>!a.slice(0,i).some(p=>p.ratio===v.ratio&&p.samples===v.samples));
}
export class AdaptiveAA{
 constructor(samples,options=ADAPTIVE_AA){this.options=options;this.levels=aaLevels(samples);this.reset();}
 reset(){this.index=this.levels.findLastIndex(l=>l.ratio===1);this.ceiling=this.levels.length-1;this.reason='initial';this.clear();}
 clear(){this.elapsed=0;this.frames=0;this.slow=0;this.stable=0;this.settle=this.options.settleSeconds;}
 get quality(){return this.levels[this.index];}
 sample(dt,active=true,targetFps=this.options.targetFps){
  if(!active||!Number.isFinite(dt)||dt<=0||dt>this.options.maxFrameSeconds){this.clear();return false;}
  if(this.settle>0){this.settle-=dt;return false;}
  const budget=1/targetFps;
  this.elapsed+=dt;this.frames++;if(dt>budget*this.options.slowFrameRatio)this.slow++;
  if(this.elapsed<this.options.windowSeconds)return false;
  const overloaded=this.slow/this.frames>this.options.slowFraction;
  const comfortable=this.elapsed/this.frames<=budget*this.options.upgradeFrameRatio;
  this.stable=comfortable?this.stable+this.elapsed:0;
  this.elapsed=0;this.frames=0;this.slow=0;
  if(overloaded&&this.index>0){
   this.index--;this.ceiling=Math.min(this.ceiling,this.index);this.reason='frame budget';this.clear();return true;
  }
  if(this.stable>=this.options.upgradeSeconds&&this.index<this.ceiling){
   this.index++;this.reason='sustained headroom';this.clear();return true;
  }
  return false;
 }
}
