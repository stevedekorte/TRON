// Best-effort crash reporting. Production builds send a small, anonymous
// report of uncaught errors, unhandled rejections, error-screen failures and
// graphics-context losses to the relay Worker (POST /api/errors). Reports never
// include page content, input, or user identity; the Worker stores no IP.
// Browsers opted out of analytics (?analytics=off) send nothing.
export const ERROR_REPORTING=Object.freeze({
  maxReportsPerPage:5,      // count
  maxMessageChars:500,      // characters
  maxStackChars:4000,       // characters
  path:'/api/errors',
});
const KINDS=new Set(['error','rejection','failure','context-lost']);
const sent=new Set();
let count=0,contextProvider=null,installed=false,gpu;

const clip=(value,limit)=>String(value??'').slice(0,limit);
function optedOut(){
  try{return new URLSearchParams(location.search).get('analytics')==='off'||!!localStorage.getItem('colvmn:no-analytics');}
  catch{return false;}
}
function endpoint(){
  const base=(import.meta.env?.VITE_ERROR_API_BASE||import.meta.env?.VITE_JEV_API_BASE||'').replace(/\/$/,'');
  return base?base+ERROR_REPORTING.path:'';
}
/** GPU strings help separate driver faults from game bugs. Cached; never throws. */
export function describeGpu(renderer){
  if(gpu!==undefined)return gpu;
  try{
    const gl=renderer?.getContext?.();if(!gl)return '';
    const info=gl.getExtension('WEBGL_debug_renderer_info');
    gpu=clip(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),200);
  }catch{gpu='';}
  return gpu;
}
/** Supplies game state (mode, renderer, quality) at report time. */
export function setErrorContext(provider){contextProvider=provider;}

/** Builds the report body. Exported for tests. */
export function buildErrorReport(kind,error,extra={}){
  let context={};try{context=contextProvider?.()??{};}catch{}
  const message=error instanceof Error?`${error.name}: ${error.message}`:typeof error==='string'?error:(()=>{try{return JSON.stringify(error);}catch{return String(error);}})();
  return {
    kind:KINDS.has(kind)?kind:'error',
    message:clip(message,ERROR_REPORTING.maxMessageChars),
    stack:clip(error?.stack,ERROR_REPORTING.maxStackChars),
    source:clip(extra.source?`${extra.source}:${extra.line??0}:${extra.column??0}`:'',300),
    build:clip(import.meta.env?.VITE_BUILD_ID||'unknown',40),
    host:clip(globalThis.location?.hostname,100),
    path:clip(globalThis.location?.pathname,200),
    userAgent:clip(globalThis.navigator?.userAgent,300),
    gpu:clip(context.gpu??'',200),
    game:clip(context.game??'',40),
    mode:clip(context.mode??'',40),
    detail:clip(context.detail??'',300),
    uptimeSeconds:Math.round((globalThis.performance?.now()??0)/1000),
  };
}

/** Sends one report unless disabled, duplicated or over the per-page cap. Never throws. */
export function reportError(kind,error,extra){
  try{
    if(!import.meta.env?.PROD||optedOut())return;
    const url=endpoint();if(!url||count>=ERROR_REPORTING.maxReportsPerPage)return;
    const report=buildErrorReport(kind,error,extra);
    const signature=report.kind+'|'+report.message+'|'+report.source;
    if(sent.has(signature))return;
    sent.add(signature);count++;
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report),keepalive:true,mode:'cors',credentials:'omit'}).catch(()=>{});
  }catch{/* Reporting must never interrupt play. */}
}

export function installErrorReporter(){
  if(installed)return;installed=true;
  addEventListener('error',event=>{
    // Resource load errors (capture phase, no error object) are handled by PWA recovery.
    if(!event.error&&!event.message)return;
    reportError('error',event.error??event.message,{source:event.filename,line:event.lineno,column:event.colno});
  });
  addEventListener('unhandledrejection',event=>reportError('rejection',event.reason));
}
