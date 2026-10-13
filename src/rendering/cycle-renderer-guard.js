// One-way per activation: no automatic upgrade/retry after a slow-machine fallback.
export const CYCLE_RENDERER_GUARD=Object.freeze({warmupSeconds:4,windowSeconds:2,slowWindows:3,minTargetFraction:.65,minFps:20,maxFps:40,maxFrameSeconds:.5});
export class CycleRendererGuard {
 constructor(options=CYCLE_RENDERER_GUARD){this.options=options;this.reset();}
 reset(){this.warmup=this.options.warmupSeconds;this.elapsed=0;this.frames=0;this.slowWindows=0;this.tripped=false;}
 sample(dt,active,targetFps=60){
  if(this.tripped)return false;
  if(!active||!Number.isFinite(dt)||dt<=0||dt>this.options.maxFrameSeconds){this.reset();return false;}
  if(this.warmup>0){this.warmup-=dt;return false;}
  this.elapsed+=dt;this.frames++;
  if(this.elapsed<this.options.windowSeconds)return false;
  const fps=this.frames/this.elapsed,threshold=Math.max(this.options.minFps,Math.min(this.options.maxFps,targetFps*this.options.minTargetFraction));
  this.slowWindows=fps<threshold?this.slowWindows+1:0;this.elapsed=0;this.frames=0;
  if(this.slowWindows<this.options.slowWindows)return false;
  this.tripped=true;return true;
 }
}
