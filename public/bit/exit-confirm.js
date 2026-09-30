// Shared by the main game and the isolated BIT page.
window.createExitConfirm = function ({onConfirm, onCancel}) {
  const style=document.createElement('style');
  style.textContent=`#exit-confirm{background:#020710;color:#159ddd;border:1px solid #159ddd;padding:28px;text-align:center;font:var(--terminal-font-size,22px)/1.4 FilmTerminal,VT323,monospace;max-width:calc(100vw - 40px)}#exit-confirm::backdrop{background:#0009}#exit-confirm p{margin:0 0 24px}#exit-confirm button{font:inherit;color:inherit;background:#071724;border:1px solid #159ddd;padding:10px 18px;margin:6px;cursor:pointer}#exit-confirm button:focus-visible{outline:2px solid #9bdfff;outline-offset:3px}`;
  document.head.append(style);
  const dialog=document.createElement('dialog');dialog.id='exit-confirm';
  dialog.setAttribute('aria-labelledby','exit-confirm-title');
  dialog.innerHTML='<p id="exit-confirm-title">RETURN TO HOME SCREEN?</p><button type="button" data-cancel autofocus>CONTINUE PLAYING</button><button type="button" data-confirm>RETURN HOME</button>';
  document.body.append(dialog);
  const close=confirm=>{if(!dialog.open)return;dialog.close();(confirm?onConfirm:onCancel)();};
  dialog.querySelector('[data-cancel]').onclick=()=>close(false);
  dialog.querySelector('[data-confirm]').onclick=()=>close(true);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close(false);});
  const keydown=event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)close(false);}
  };
  window.addEventListener('keydown',keydown,true);
  return {get open(){return dialog.open;},show(){if(!dialog.open){dialog.showModal();dialog.querySelector('[data-cancel]').focus();}},dispose(){window.removeEventListener('keydown',keydown,true);dialog.remove();style.remove();}};
};
