/** Pointer capture keeps held pedals reliable when a finger slides off its zone. */
export class CycleTouchControls {
 constructor({onTurn,onHeld,onMenu,onHelp,onRestart}){
  Object.assign(this,{onTurn,onHeld});this.held=new Map();this.enabled=false;
  this.element=document.createElement('nav');this.element.id='cycle-touch-controls';this.element.hidden=true;this.element.setAttribute('aria-label','Light cycle touch controls');
  this.element.innerHTML='<button data-action="left" aria-label="Turn left">◀<span>TURN</span></button><button data-action="right" aria-label="Turn right">▶<span>TURN</span></button><button data-action="turbo">HOLD<br>TURBO</button><button data-action="brake">HOLD<br>BRAKE</button><button data-action="menu">MENU</button><button data-action="help">CONTROLS</button><button data-action="restart" hidden>NEW MATCH</button>';
  this.buttons=Object.fromEntries([...this.element.querySelectorAll('button')].map(b=>[b.dataset.action,b]));
  for(const action of ['left','right','turbo','brake']){
   const button=this.buttons[action];
   button.addEventListener('pointerdown',event=>{
    if(!this.enabled||button.disabled||event.button!==0)return;
    event.preventDefault();event.stopPropagation();button.setPointerCapture(event.pointerId);
    if(action==='left'||action==='right')onTurn(action==='left'?-1:1);
    else{this.held.set(event.pointerId,action);this.syncHeld();}
   });
   const release=event=>{this.held.delete(event.pointerId);this.syncHeld();};
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  }
  this.buttons.menu.onclick=onMenu;this.buttons.help.onclick=onHelp;this.buttons.restart.onclick=onRestart;
  this.blur=()=>this.clear();window.addEventListener('blur',this.blur);
  this.visibility=()=>{if(document.hidden)this.clear();};document.addEventListener('visibilitychange',this.visibility);
  document.body.append(this.element);
 }
 syncHeld(){const values=[...this.held.values()];this.onHeld(values.includes('turbo'),values.includes('brake'));}
 clear(){this.held.clear();this.syncHeld();}
 update({visible,driving,spectating,restart}){
  this.enabled=visible;this.element.hidden=!visible;
  if(!visible||!driving)this.clear();
  this.buttons.left.disabled=this.buttons.right.disabled=!driving&&!spectating;
  this.buttons.turbo.hidden=this.buttons.brake.hidden=!driving;
  this.buttons.restart.hidden=!restart;
  const label=spectating?'FOLLOW':'TURN';
  for(const action of ['left','right']){this.buttons[action].querySelector('span').textContent=label;this.buttons[action].setAttribute('aria-label',`${label} ${action}`);}
 }
 dispose(){this.clear();window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.element.remove();}
}
