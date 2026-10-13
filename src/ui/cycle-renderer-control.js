const NOTICE_MILLISECONDS=4000;
/** Lazy loading; no CSG import or GPU allocation on the normal path. */
export class CycleRendererControl {
 constructor({getView,getRun,getMode}){
  Object.assign(this,{getView,getRun,getMode});this.busy=false;this.disposed=false;this.autoAttempted=new URLSearchParams(location.search).get('cycleRenderer')==='normal';
  const button=this.button=document.createElement('button');button.id='cycle-renderer';button.type='button';button.hidden=true;button.textContent='SHIFT-R / RENDERER: NORMAL';
  Object.assign(button.style,{position:'fixed',left:'20px',bottom:'16px',zIndex:'12',background:'#020c1bcc',color:'#159ddd',border:'1px solid #159ddd55',padding:'6px 10px',font:'400 var(--game-font-size)/1.2 FilmTerminal,monospace',cursor:'pointer'});
  this.click=()=>void this.toggle();button.addEventListener('click',this.click);document.body.append(button);
 }
 update(){
  const visible=this.getRun()?.playerVehicle==='cycle'&&['running','entering'].includes(this.getMode()),view=this.getView();
  const state=`${view?.cycleRendererMode}:${view?.cycleRendererReason}`;
  if(state!==this.lastState){this.lastState=state;this.noticeUntil=performance.now()+NOTICE_MILLISECONDS;}
  this.button.hidden=!visible||this.busy||view?.cycleRendererMode==='pov'||performance.now()>=this.noticeUntil;
  if(visible&&view?.arena&&!this.autoAttempted){this.autoAttempted=true;void this.select('pov');}
  if(!this.busy){const label=`SHIFT-R / RENDERER: ${view?.cycleRendererMode==='pov'?'POV-RAY':view?.cycleRendererReason==='performance'?'NORMAL (PERFORMANCE)':'NORMAL'}`;if(this.button.textContent!==label)this.button.textContent=label;}
 }
 async toggle(){this.autoAttempted=true;return this.select(this.getView()?.cycleRendererMode==='pov'?'normal':'pov');}

 async select(mode){
  const view=this.getView();if(this.busy||this.disposed||!view)return;
  this.busy=true;this.button.disabled=true;this.button.textContent=mode==='pov'?'PREPARING POV-RAY CYCLES…':'RESTORING NORMAL RENDERER…';
  try{await view.setCycleRenderer(mode);}
  catch(error){console.error('Cycle renderer:',error);this.button.title=error.message;}
  finally{this.busy=false;if(!this.disposed){this.button.disabled=false;this.button.textContent=`SHIFT-R / RENDERER: ${view.cycleRendererMode==='pov'?'POV-RAY':'NORMAL'}`;}}
 }
 dispose(){this.disposed=true;this.button.removeEventListener('click',this.click);this.button.remove();}
}
