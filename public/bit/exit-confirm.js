// Shared by the main game and the isolated BIT page.
window.createExitConfirm = function ({onConfirm, onCancel, muted=()=>false}) {
  const style=document.createElement('style');
  style.textContent=`
    #exit-confirm{background:transparent;color:#159ddd;border:0;padding:28px;text-align:left;font:var(--terminal-font-size,22px)/1.12 FilmTerminal,VT323,monospace;letter-spacing:.025em;text-shadow:0 0 3px #0a91db,0 0 10px #005b9566;max-width:calc(100vw - 40px)}
    #exit-confirm::backdrop{background:#0009}
    #exit-confirm p{margin:0 0 1.12em}
    #exit-confirm button{display:flex;align-items:center;gap:1ch;font:inherit;letter-spacing:inherit;text-shadow:inherit;color:inherit;background:none;border:0;border-radius:0;padding:0;margin:0;text-align:left;cursor:pointer;touch-action:manipulation;outline:none;box-shadow:none}
    #exit-confirm .menu-marker{display:inline-block;flex:none;width:.48em;height:.78em;visibility:hidden;background:repeating-linear-gradient(to top,color-mix(in srgb,currentColor 68%,transparent) 0,color-mix(in srgb,currentColor 68%,transparent) .015em,currentColor .015em,currentColor .08em);box-shadow:0 0 5px #0a91db;animation:exit-cursor-blink .85s steps(1) infinite}
    #exit-confirm button[aria-pressed="true"] .menu-marker{visibility:visible}
    @keyframes exit-cursor-blink{50%{opacity:0}}
    .exit-touch-menu{display:none}
    @media(pointer:coarse){.exit-touch-menu{display:block;position:fixed;left:env(safe-area-inset-left,0px);bottom:env(safe-area-inset-bottom,0px);z-index:100;min-width:64px;min-height:48px;background:#020204aa;border:0;color:#159ddd;font:16px FilmTerminal,VT323,monospace;touch-action:manipulation}#exit-confirm{font-size:max(16px,var(--terminal-font-size,22px));line-height:1.4}#exit-confirm button{min-height:48px;width:100%;padding:6px 0}}
    @media(prefers-reduced-motion:reduce){#exit-confirm .menu-marker{animation:none}}
  `;
  document.head.append(style);
  const dialog=document.createElement('dialog');dialog.id='exit-confirm';
  dialog.setAttribute('aria-labelledby','exit-confirm-title');
  dialog.innerHTML='<p id="exit-confirm-title">RETURN TO HOME SCREEN?</p><button type="button" data-cancel aria-pressed="true" autofocus><span class="menu-marker" aria-hidden="true"></span><span>CONTINUE PLAYING</span></button><button type="button" data-confirm aria-pressed="false"><span class="menu-marker" aria-hidden="true"></span><span>RETURN HOME</span></button>';
  document.body.append(dialog);
  const choices=[...dialog.querySelectorAll('button')];
  const select=button=>{for(const choice of choices)choice.setAttribute('aria-pressed',String(choice===button));};
  for(const button of choices){
    button.addEventListener('focus',()=>select(button));
    button.addEventListener('pointerenter',()=>button.focus());
  }
  let feedbackContext,confirmTimer,touchMenu;
  const prepareFeedback=()=>{try{feedbackContext??=new AudioContext();void feedbackContext.resume().catch(()=>{});}catch{}};
  const close=confirm=>{
    if(!dialog.open)return;
    if(confirm&&!muted()){
      prepareFeedback();
      if(feedbackContext){const c=feedbackContext,now=c.currentTime,tone=c.createOscillator(),gain=c.createGain();
        tone.frequency.setValueAtTime(980,now);tone.frequency.setValueAtTime(1470,now+.085);
        gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.08,now+.002);gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
        tone.connect(gain);gain.connect(c.destination);tone.start();tone.stop(now+.19);tone.onended=()=>{tone.disconnect();gain.disconnect();};
      }
    }
    dialog.close();
    // Give immediate feedback time to play before full-document navigation or
    // a synchronous scene reset can tear down or stall this document.
    if(confirm)confirmTimer=setTimeout(onConfirm,200);else onCancel();
  };
  dialog.querySelector('[data-cancel]').onclick=()=>close(false);
  dialog.querySelector('[data-confirm]').onclick=()=>close(true);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close(false);});
  const keydown=event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){
      event.preventDefault();
      if(!event.repeat)choices[(choices.findIndex(button=>button.getAttribute('aria-pressed')==='true')+1)%choices.length].focus();
    }
    if(['Enter','NumpadEnter','Space'].includes(event.code)){
      event.preventDefault();
      if(!event.repeat)close(choices[1].getAttribute('aria-pressed')==='true');
    }
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)close(false);}
  };
  window.addEventListener('keydown',keydown,true);
  return {addTouchMenu(onRequest){touchMenu=document.createElement('button');touchMenu.className='exit-touch-menu';touchMenu.textContent='MENU';touchMenu.type='button';touchMenu.onclick=event=>{event.stopPropagation();onRequest();};document.body.append(touchMenu);},get open(){return dialog.open;},show(){prepareFeedback();if(!dialog.open){dialog.showModal();dialog.querySelector('[data-cancel]').focus();}},dispose(){touchMenu?.remove();clearTimeout(confirmTimer);void feedbackContext?.close().catch(()=>{});window.removeEventListener('keydown',keydown,true);dialog.remove();style.remove();}};
};
