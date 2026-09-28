/** Startup-only instrumentation. Reports are plain text so Safari can copy them. */
export class LoadingTimings {
  constructor() {
    this.rows=[];
    this.record('Navigation to app startup (document, modules, initial paint)',0);
    window.tronLoadingReport=()=>this.report();
  }
  record(label,start,end=performance.now()) {
    const row={label,startMs:Math.round(start),endMs:Math.round(end),durationMs:Math.round(end-start)};
    this.rows.push(row);
    console.info(`[TRON loading] ${label}: ${row.durationMs} ms (${row.endMs} ms since navigation)`);
  }
  sync(label,work) {
    const start=performance.now();
    try{return work();}finally{this.record(label,start);}
  }
  async async(label,work) {
    const start=performance.now();
    try{return await work();}finally{this.record(label,start);}
  }
  checkpoint(label) { this.record(label,0); }
  report() {
    return ['--- TRON loading report ---',
      `Browser: ${navigator.userAgent}`,
      `Viewport: ${innerWidth}x${innerHeight}, pixel ratio ${devicePixelRatio}`,
      'Times in ms from navigation. Overlapping asset durations are not additive.',
      ...this.rows.map(r=>`${r.label}: ${r.durationMs} ms [${r.startMs}–${r.endMs}]`),
      '--- End TRON loading report ---'].join('\n');
  }
  print() {console.info(this.report());}
}
