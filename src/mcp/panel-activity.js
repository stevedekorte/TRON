// Reuse the exact badge pixels; only its six lamps change brightness.
export function createPanelActivity(panel){
 const lamps=Array.from({length:6},(_,i)=>{
  const lamp=document.createElement('span');
  lamp.className='mcp-panel-lamp';lamp.style.setProperty('--lamp',i);
  lamp.setAttribute('aria-hidden','true');panel.append(lamp);return lamp;
 });
 return {
  set(stage){
   if(stage)panel.dataset.activity=stage;else delete panel.dataset.activity;
   panel.setAttribute('aria-label',stage?`ENCOM control panel — ${{stt:'listening',llm:'processing response',tts:'preparing voice'}[stage]}`:'ENCOM control panel');
  },
  dispose(){delete panel.dataset.activity;lamps.forEach(lamp=>lamp.remove());},
 };
}
