// Shared by the main game and the isolated BIT page.
window.createExitConfirm = function ({onConfirm, onCancel}) {
  const style=document.createElement('style');
  style.textContent=`
    #exit-confirm{background:transparent;color:#159ddd;border:0;padding:28px;text-align:left;font:var(--terminal-font-size,22px)/1.12 FilmTerminal,VT323,monospace;letter-spacing:.025em;text-shadow:0 0 3px #0a91db,0 0 10px #005b9566;max-width:calc(100vw - 40px)}
    #exit-confirm::backdrop{background:#0009}
    #exit-confirm p{margin:0 0 1.12em}
    #exit-confirm button{display:flex;align-items:center;gap:1ch;font:inherit;letter-spacing:inherit;text-shadow:inherit;color:inherit;background:none;border:0;border-radius:0;padding:0;margin:0;text-align:left;cursor:pointer;touch-action:manipulation;outline:none;box-shadow:none}
    #exit-confirm .menu-marker{display:inline-block;flex:none;width:.48em;height:.78em;visibility:hidden;background:repeating-linear-gradient(to top,color-mix(in srgb,currentColor 68%,transparent) 0,color-mix(in srgb,currentColor 68%,transparent) .015em,currentColor .015em,currentColor .08em);box-shadow:0 0 5px #0a91db;animation:exit-cursor-blink .85s steps(1) infinite}
    #exit-confirm button[aria-pressed="true"] .menu-marker{visibility:visible}
    @keyframes exit-cursor-blink{50%{opacity:0}}
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
  const close=confirm=>{if(!dialog.open)return;dialog.close();(confirm?onConfirm:onCancel)();};
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
  return {get open(){return dialog.open;},show(){if(!dialog.open){dialog.showModal();dialog.querySelector('[data-cancel]').focus();}},dispose(){window.removeEventListener('keydown',keydown,true);dialog.remove();style.remove();}};
};
