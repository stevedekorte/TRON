import {beginBootStage,printBootLine} from '../loading/boot-terminal.js';
/** Startup-only instrumentation. Reports are plain text so Safari can copy them. */
export class LoadingTimings {
  constructor() {
    this.rows=[];
    this.record('Navigation to app startup (document, modules, initial paint)',0,performance.now(),false);
    const entry=performance.getEntriesByName('tron:entry').at(-1);
    const request=performance.getEntriesByName('tron:module-request').at(-1);
    const ready=performance.getEntriesByName('tron:module-ready').at(-1);
    if(entry)this.record('Entry document / bootstrap download',0,entry.startTime);
    if(entry&&request)this.record('Styles / loading terminal paint',entry.startTime,request.startTime);
    if(request&&ready)this.record('Game modules download / evaluation',request.startTime,ready.startTime);
    window.tronLoadingReport=()=>this.report();
  }
  record(label,start,end=performance.now(),boot=true) {
    const row={label,startMs:Math.round(start),endMs:Math.round(end),durationMs:Math.round(end-start)};
    this.rows.push(row);
    if(boot)printBootLine(label,end-start);
    console.info(`[TRON loading] ${label}: ${row.durationMs} ms (${row.endMs} ms since navigation)`);
  }
  sync(label,work) {
    const start=performance.now();
    beginBootStage(label);
    try{return work();}finally{this.record(label,start);}
  }
  async async(label,work) {
    const start=performance.now();
    beginBootStage(label);
    try{return await work();}finally{this.record(label,start);}
  }
  checkpoint(label) { this.record(label,0,performance.now(),false); }
  report() {
    return ['--- TRON loading report ---',
      `Browser: ${navigator.userAgent}`,
      ...(this.seeds?[`Seeds: layoutSeed=${this.seeds.layoutSeed}, runSeed=${this.seeds.runSeed}`]:[]),
      `Viewport: ${innerWidth}x${innerHeight}, pixel ratio ${devicePixelRatio}`,
      'Times in ms from navigation. Overlapping asset durations are not additive.',
      ...this.rows.map(r=>`${r.label}: ${r.durationMs} ms [${r.startMs}–${r.endMs}]`),
      '--- End TRON loading report ---'].join('\n');
  }
  print() {console.info(this.report());}
}
