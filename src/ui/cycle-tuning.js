import {DEFAULT_POLICY,POLICY_BOUNDS,validatePolicy} from '../../shared/simulation/cycle-ai/config.js';
import {resetCycleAI} from '../../shared/simulation/cycle-ai/controller.js';
import {ROAD_CYCLE,ROAD_CYCLE_FIELDS,migrateRoadCycleTuning} from '../../shared/simulation/config/cycle-road.js';
const STORAGE_KEY='tron-cycle-road-tuning-v1';
/** Modal owns its DOM/listeners; simulation settings stay with GameSession. */
export class CycleTuning {
 constructor({session,onOpen,onClose}){
  Object.assign(this,{session,onOpen,onClose});this.listeners=[];
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved)session.configure('roadCycle',migrateRoadCycleTuning(saved));}catch{}
  const dialog=this.dialog=document.createElement('dialog');dialog.id='cycle-tuning';dialog.setAttribute('aria-labelledby','cycle-tuning-title');
  dialog.innerHTML=`<header><div><h2 id="cycle-tuning-title">Cycle dynamics</h2><p>Road handling · simulation paused while editing</p></div><button type="button" data-close aria-label="Close cycle dynamics">Close · Esc</button></header><p class="cycle-tuning-note">Changes apply when you resume. Settings are saved in this browser. Arena controls are unchanged.</p><div class="cycle-tuning-fields"></div><footer><button type="button" data-reset>Reset defaults</button><button type="button" data-copy>Copy settings</button><span role="status" aria-live="polite"></span></footer>`;
  this.status=dialog.querySelector('[role=status]');this.controls=new Map();
  const fields=dialog.querySelector('.cycle-tuning-fields');
  for(const [group,rows] of Object.entries(ROAD_CYCLE_FIELDS)){
   const section=document.createElement('details');section.open=group==='Speed and pedals';
   const heading=document.createElement('summary');heading.textContent=group;section.append(heading);
   if(group==='Speed and pedals'){
    const note=document.createElement('p');note.textContent='W/S adjusts held speed; X brakes; T uses turbo. Speed hold compensates drag; drag changes are most noticeable under turbo.';section.append(note);
   }
   for(const [key,title,unit,min,max,step] of rows){
    const label=document.createElement('label');label.className='cycle-tuning-row';
    const name=document.createElement('span');name.textContent=`${title} (${unit})`;label.append(name);
    const range=document.createElement('input');Object.assign(range,{type:'range',min,max,step});range.dataset.param=key;range.setAttribute('aria-label',`${title} (${unit})`);
    const number=document.createElement('input');Object.assign(number,{type:'number',min,max,step});number.dataset.value=key;number.setAttribute('aria-label',`${title} value (${unit})`);
    label.append(range,number);section.append(label);this.controls.set(key,{range,number});
    const update=input=>{
     try{
      if(input.value==='')throw new Error('Enter a numeric value.');
      session.configure('roadCycle',{[key]:Number(input.value)});this.sync();this.save();this.status.textContent='Saved · applies on resume';
     }catch(error){this.status.textContent=error.message;this.sync();}
    };
    this.listen(range,'input',()=>update(range));this.listen(number,'change',()=>update(number));
   }
   fields.append(section);
  }
  if(import.meta.env.DEV){
   const section=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Arena AI · local testing';section.append(heading);
   const note=document.createElement('p');note.textContent='Behavior weights only. Safety and runtime limits are fixed. Multiplayer AI is controlled by the server.';section.append(note);
   this.aiControls=new Map();
   for(const [key,[min,max]] of Object.entries(POLICY_BOUNDS)){
    const label=document.createElement('label');label.className='cycle-tuning-row';const title=document.createElement('span');title.textContent=key;
    const input=document.createElement('input');Object.assign(input,{type:'number',min,max,step:.01});input.setAttribute('aria-label',`AI ${key}`);label.append(title,input);section.append(label);this.aiControls.set(key,input);
    this.listen(input,'change',()=>{
     const race=session.run.cycleRace;if(!race||session.run.multiplayer)return;
     try{race.aiPolicy=validatePolicy({...DEFAULT_POLICY,...race.aiPolicy,[key]:Number(input.value)});race.aiMode='bounded';resetCycleAI(race);this.status.textContent='AI policy updated for this arena';}catch(error){this.status.textContent=error.message;}
     this.sync();
    });
   }
   fields.append(section);
  }
  this.listen(dialog.querySelector('[data-close]'),'click',()=>dialog.close());
  this.listen(dialog,'close',()=>{this.onClose?.();});
  this.listen(dialog.querySelector('[data-reset]'),'click',()=>{session.configure('roadCycle',ROAD_CYCLE);this.sync();this.save();this.status.textContent='Defaults restored';});
  this.listen(dialog.querySelector('[data-copy]'),'click',async()=>{
   try{await navigator.clipboard.writeText(JSON.stringify(session.settings.roadCycle,null,2));this.status.textContent='Settings copied';}catch{this.status.textContent='Clipboard unavailable';}
  });
  document.body.append(dialog);this.sync();
 }
 listen(target,event,handler){target.addEventListener(event,handler);this.listeners.push(()=>target.removeEventListener(event,handler));}
 get open(){return this.dialog.open;}
 show(){if(this.open)return;this.sync();this.status.textContent='';this.onOpen?.();this.dialog.showModal();this.dialog.querySelector('[data-close]').focus();}
 sync(){
  for(const [key,input] of this.aiControls??[]){input.value=(this.session.run.cycleRace?.aiPolicy??DEFAULT_POLICY)[key];input.disabled=!!this.session.run.multiplayer;}
  for(const [key,{range,number}] of this.controls){range.value=number.value=this.session.settings.roadCycle[key];}}
 save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.session.settings.roadCycle));}catch{}}
 dispose(){this.onClose=null;for(const remove of this.listeners)remove();this.dialog.remove();}
}
