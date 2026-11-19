import {isMobileTerminal} from './mobile-terminal.js';
const NOTICE_MILLISECONDS=4000;
// Some drivers (ANGLE Direct3D) turn a draw-time shader failure into context
// loss instead of an error. A loss while POV-Ray cycles were active or
// preparing switches to the normal renderer (the game continues once the
// browser restores the context) and is remembered, so reloads start normal. A new revision of the
// CSG shader retries automatically; Shift-R always can.
export const POV_FAILURE_STORAGE={key:'tron.povCycleContextLoss',revision:'csg-single-call-site-2026-11-18'};
// CPU rasterizers take tens of seconds to compile the CSG shader and cannot
// hold its frame rate; they start (and stay unless chosen) on normal cycles.
export function softwareRenderer(name){return /SwiftShader|llvmpipe|softpipe|Software Rasterizer|Basic Render Driver|Microsoft Basic/i.test(name??'');}
function rendererName(gl){try{const info=gl.getExtension('WEBGL_debug_renderer_info');return info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}catch{return '';}}
function storedPovFailure(){try{return localStorage.getItem(POV_FAILURE_STORAGE.key)===POV_FAILURE_STORAGE.revision;}catch{return false;}}
function storePovFailure(failed){try{if(failed)localStorage.setItem(POV_FAILURE_STORAGE.key,POV_FAILURE_STORAGE.revision);else localStorage.removeItem(POV_FAILURE_STORAGE.key);}catch{}}
/** Lazy loading; no CSG import or GPU allocation on the normal path. */
export class CycleRendererControl {
 constructor({getView,getRun,getMode}){
  Object.assign(this,{getView,getRun,getMode});this.busy=false;this.disposed=false;this.priorFailure=storedPovFailure();// Phones and tablets start on the normal renderer: mobile GPU drivers and
  // watchdogs are the least predictable with the CSG shader. The button opts in.
  this.autoAttempted=this.priorFailure||isMobileTerminal()||new URLSearchParams(location.search).get('cycleRenderer')==='normal';
  const button=this.button=document.createElement('button');button.id='cycle-renderer';button.type='button';button.hidden=true;button.textContent='SHIFT-R / RENDERER: NORMAL';
  Object.assign(button.style,{position:'fixed',left:'20px',bottom:'16px',zIndex:'12',background:'#020c1bcc',color:'#159ddd',border:'1px solid #159ddd55',padding:'6px 10px',font:'400 var(--game-font-size)/1.2 FilmTerminal,monospace',cursor:'pointer'});
  this.click=()=>void this.toggle();button.addEventListener('click',this.click);document.body.append(button);
 }
 update(){
  const visible=this.getRun()?.playerVehicle==='cycle'&&['running','entering'].includes(this.getMode()),view=this.getView();
  const state=`${view?.cycleRendererMode}:${view?.cycleRendererReason}${this.priorFailure?`:${visible}`:''}`;
  if(state!==this.lastState){this.lastState=state;this.noticeUntil=performance.now()+NOTICE_MILLISECONDS;}
  this.button.hidden=!visible||(!this.busy&&(view?.cycleRendererMode==='pov'||performance.now()>=this.noticeUntil));
  if(visible&&view?.arena&&!this.autoAttempted){this.autoAttempted=true;if(softwareRenderer(rendererName(view.renderer.getContext())))this.softwareRenderer=true;else void this.select('pov');}
  if(!this.busy){const label=`SHIFT-R / RENDERER: ${view?.cycleRendererMode==='pov'?'POV-RAY':view?.cycleRendererReason==='performance'?'NORMAL (PERFORMANCE)':view?.cycleRendererReason==='self-test'?'NORMAL (POV SELF-TEST FAILED)':this.lastError?'NORMAL (POV FAILED — SEE CONSOLE)':this.priorFailure?'NORMAL (POV GRAPHICS FAILURE)':this.softwareRenderer?'NORMAL (SOFTWARE GRAPHICS)':'NORMAL'}`;if(this.button.textContent!==label)this.button.textContent=label;}
 }
 async toggle(){this.autoAttempted=true;return this.select(this.getView()?.cycleRendererMode==='pov'?'normal':'pov');}

 async select(mode){
  const view=this.getView();if(this.busy||this.disposed||!view)return;
  this.busy=true;this.button.disabled=true;this.button.textContent=mode==='pov'?'PREPARING POV-RAY CYCLES…':'RESTORING NORMAL RENDERER…';
  this.pendingMode=mode;
  this.lastError=null;const started=performance.now();
  try{if(await view.setCycleRenderer(mode)==='pov'){this.priorFailure=false;storePovFailure(false);console.info(`POV-Ray cycles ready in ${Math.round(performance.now()-started)} ms`);}}
  catch(error){
   console.error('Cycle renderer:',error);this.button.title=error.message;this.lastError=error.message;
  }
  finally{this.busy=false;this.pendingMode=null;this.lastState=null;if(!this.disposed){this.button.disabled=false;this.button.textContent=`SHIFT-R / RENDERER: ${view.cycleRendererMode==='pov'?'POV-RAY':'NORMAL'}`;}}
 }
 /** Call from the webglcontextlost handler; returns true when POV was implicated. */
 noteContextLost(){
  const view=this.getView(),implicated=view?.cycleRendererMode==='pov'||(this.busy&&this.pendingMode==='pov');
  if(!implicated)return false;
  storePovFailure(true);this.priorFailure=true;this.autoAttempted=true;this.lastState=null;
  // Drop the CSG shader now so the restored context never recompiles it; this
  // also supersedes a POV preparation still in flight.
  view.setCycleRenderer('normal').catch(error=>console.error('Cycle renderer:',error));
  return true;
 }
 dispose(){this.disposed=true;this.button.removeEventListener('click',this.click);this.button.remove();}
}
